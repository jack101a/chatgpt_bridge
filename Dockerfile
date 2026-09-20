# =============================================================================
# Stage 1: Build Vite / React Companion Dashboard UI
# =============================================================================
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Leverage Docker layer cache for npm deps — only rebuilds when package files change
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci

# Copy source and compile production bundle
COPY frontend/ ./
RUN npm run build


# =============================================================================
# Stage 2: Production Python + Playwright/Chromium + Xvfb Runtime
# =============================================================================
FROM python:3.11-slim-bookworm AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    CHATGPT_BRIDGE_STATE=/data \
    SCREEN_WIDTH=1280 \
    SCREEN_HEIGHT=720 \
    PORT=8465 \
    HOST=0.0.0.0

WORKDIR /app

# 1. Install base system utilities: Xvfb virtual framebuffer, tini init, curl for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
    xvfb \
    ca-certificates \
    curl \
    tini \
    && rm -rf /var/lib/apt/lists/*

# 2. Cache Python project metadata independently of source code.
#    Changing Python source won't bust this layer or trigger Chromium re-download.
COPY python/pyproject.toml /app/python/pyproject.toml

# 3. Install Python runtime deps declared in pyproject.toml [project.dependencies]
#    Using --no-deps on the actual package install avoids double-fetching
RUN pip install --no-cache-dir -e /app/python

# 4. Install ONLY Chromium browser binary + its system shared libraries (~600MB).
#    Skips WebKit and Firefox to save ~600MB. Runs after pip so playwright
#    browser download is also cached independently of Python code changes.
RUN playwright install --with-deps chromium \
    && rm -rf /var/lib/apt/lists/* \
    && chmod -R o+rx /ms-playwright

# 5. Copy compiled Vite frontend assets from Stage 1.
#    daemon.py auto-detects /app/frontend/dist and serves the dashboard + API on one port.
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

# 6. Copy Python backend source (last — changes here only rebuild this final layer)
COPY python /app/python
# Re-install in development/editable mode now that source is present
RUN pip install --no-cache-dir --no-deps -e /app/python

# 7. Entrypoint
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Persistent storage for session cookies, profiles, databases, and images
VOLUME /data

# REST API + Web Dashboard port
EXPOSE 8465

# Healthcheck: curl the /health endpoint. start-period accounts for Xvfb + Chromium boot.
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=45s \
  CMD curl -f http://localhost:${PORT:-8465}/health || exit 1

# tini -g: reap zombie Chromium renderer processes AND broadcast SIGTERM to
# the whole process group (Xvfb + Python + Chromium) on graceful shutdown.
ENTRYPOINT ["/usr/bin/tini", "-g", "--", "/app/docker-entrypoint.sh"]

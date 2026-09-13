FROM python:3.11-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    CHATGPT_BRIDGE_STATE=/data \
    SCREEN_WIDTH=1280 \
    SCREEN_HEIGHT=720 \
    PORT=8465

WORKDIR /app

# Install system dependencies: Xvfb, certificates, curl, tini, and playwright dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    xvfb \
    ca-certificates \
    curl \
    tini \
    && rm -rf /var/lib/apt/lists/*

# Copy python project
COPY python /app/python

# Install python dependencies and playwright chromium browser with system dependencies
RUN pip install --no-cache-dir -e /app/python \
    && playwright install --with-deps chromium

# Copy entrypoint script
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Data directory for persistent profile, cookies, and generated images
VOLUME /data
EXPOSE 8465

ENTRYPOINT ["/usr/bin/tini", "--", "/app/docker-entrypoint.sh"]

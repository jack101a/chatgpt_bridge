# Docker & Portainer Deployment Guide

> **ChatGPT Bridge** — Production deployment reference for Docker / Portainer CE/EE.

---

## Quick Start (Docker CLI)

```bash
# 1. Pull the latest image
docker pull ghcr.io/jack101a/chatgpt-bridge-app:latest

# 2. Run with 2GB shared memory (critical for Chromium stability)
docker run -d \
  --name chatgpt-bridge \
  --restart unless-stopped \
  --shm-size=2gb \
  -p 8465:8465 \
  -v chatgpt_bridge_data:/data \
  -e TZ=Asia/Kolkata \
  ghcr.io/jack101a/chatgpt-bridge-app:latest
```

Access the web dashboard at `http://<HOST_IP>:8465` and the API docs at `http://<HOST_IP>:8465/docs`.

---

## Portainer Stack Deployment (Recommended)

### Step 1 — Open Portainer

Navigate to your Portainer dashboard → **Stacks** → **Add stack**.

### Step 2 — Create Stack

1. Name the stack: **`chatgpt-bridge`**
2. Select the **Web editor** tab
3. Paste the contents of [`docker-compose.yml`](../docker-compose.yml)

### Step 3 — Configure Environment Variables

In the **Environment variables** section below the editor, set:

| Variable | Value | Notes |
|----------|-------|-------|
| `PORT` | `8465` | External port |
| `TZ` | `Asia/Kolkata` | Your timezone |
| `MODE` | `api` | `api` for REST+UI, `bot` for Telegram |
| `TELEGRAM_BOT_TOKEN` | *(optional)* | Required for Telegram bot mode |
| `TELEGRAM_ALLOWED_USER_IDS` | `*` | Comma-separated or `*` for all |
| `OPENAI_API_KEY` | *(optional)* | For fallback LLM provider |

> **Never** put these in the compose YAML — Portainer's env var section keeps secrets out of Git.

### Step 4 — Deploy

Click **Deploy the stack**. Portainer will:

1. Pull the image
2. Create the `chatgpt_bridge_data` named volume
3. Start the container with 2GB shared memory and resource limits
4. Begin healthcheck polling of `/health` every 30s

The status badge will show **starting** for up to 45s (Xvfb + Chromium boot), then transition to a green **healthy** badge.

---

## Data Directory Map

All persistent state lives in `/data` (the mounted volume):

```
/data/
├── cookies.json              # Primary ChatGPT authentication session
├── cookies.txt               # Alternative Netscape-format cookies
├── settings.json             # Runtime configuration (theme, defaults)
├── characters.json           # Character cards and Visual DNA presets
├── prompt_library.json       # Curated prompt database (auto-populated)
├── conversation_contracts.json
├── client_state.json
├── vault_backups.json
├── images/                   # Downloaded DALL-E images (.png / .webp)
├── uploads/                  # Temporary reference images for context edits
└── profile/                  # Chromium user profile (cookies, IndexedDB)
```

### Mounting Cookies

The easiest way to authenticate is to copy `cookies.json` into the volume:

```bash
# Copy from host into the named volume
docker cp /path/to/cookies.json chatgpt-bridge:/data/cookies.json

# Or use the API endpoint (no container restart needed):
curl -X POST http://localhost:8465/accounts \
  -H "Content-Type: application/json" \
  -d '{"alias": "main", "cookies": "<paste netscape cookie text>"}'
```

---

## Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8465` | HTTP listener port |
| `HOST` | `0.0.0.0` | Network binding (must be `0.0.0.0` in Docker) |
| `MODE` | `api` | `api` (REST + Dashboard) or `bot` (Telegram) |
| `SCREEN_WIDTH` | `1280` | Xvfb virtual display width |
| `SCREEN_HEIGHT` | `720` | Xvfb virtual display height (720p 16:9) |
| `CHATGPT_BRIDGE_STATE` | `/data` | Persistent state directory |
| `BROWSER_IDLE_TIMEOUT_S` | `300` | Seconds idle before Chromium closes to free RAM |
| `MAX_RETRIES` | `10` | Max retry attempts for UI operations |
| `CHATGPT_BRIDGE_MAX_QUEUED_CHATS` | `20` | Queue depth before 429 backpressure |
| `CHATGPT_BRIDGE_MAX_QUEUED_IMAGES` | `10` | Image request queue depth |
| `TELEGRAM_BOT_TOKEN` | *(empty)* | Telegram @BotFather token |
| `TELEGRAM_ALLOWED_USER_IDS` | `*` | Comma-separated IDs, or `*` for all |
| `TZ` | `UTC` | Container timezone |
| `OPENAI_API_KEY` | *(empty)* | Optional fallback LLM key |

---

## Resource Requirements & Limits

### Memory Footprint (Measured)

| Component | Idle | Under Load (DALL-E + Chat) |
|-----------|------|---------------------------|
| FastAPI + Uvicorn | ~100 MB | ~180 MB |
| Xvfb (1280×720×24) | ~40 MB | ~70 MB |
| Chromium Browser + GPU process | ~250 MB | ~450 MB |
| Chromium Renderer (ChatGPT SPA) | ~450 MB | ~1.2 GB |
| **Total** | **~840 MB** | **~1.9 GB** |

### Recommended Limits

```yaml
deploy:
  resources:
    limits:
      cpus: "1.50"
      memory: 2G      # Safe for 8GB RAM host systems
    reservations:
      cpus: "0.25"
      memory: 512M
```

> **Why limits matter:** Without a memory limit, a Chromium V8 heap leak can exhaust host RAM and trigger the Linux OOM killer, which may terminate the Docker daemon, Portainer, or SSH access. With limits, only the container is killed.

---

## Shared Memory (`/dev/shm`) — Critical

Docker's default `/dev/shm` is **64 MB**. Chromium uses shared memory to pass frame buffers between Browser, GPU/Viz, and Renderer processes. At 1280×720×32-bit, a single frame = 3.7 MB. With double-buffering + canvas rendering + DALL-E image generation, usage easily reaches 200–400 MB — causing `SIGBUS` crashes and `Target closed` Playwright errors.

**Always set `shm_size: "2gb"`** in `docker-compose.yml` or `--shm-size=2gb` in `docker run`.

The `browser.py` launch args also include `--disable-dev-shm-usage` as an emergency fallback (redirects to `/tmp`) but the primary fix is the shm size.

---

## Architecture: Why a Single Container?

```
┌─────────────────────────────────────────────────────┐
│                Docker Container                      │
│                                                     │
│  ┌─────────┐   ┌──────────────┐   ┌─────────────┐  │
│  │  Xvfb   │   │   FastAPI    │   │   Chromium  │  │
│  │ :99     │   │  + Vite UI   │   │  (headed)   │  │
│  │ 1280×720│   │  port 8465   │   │  via Xvfb   │  │
│  └────┬────┘   └──────┬───────┘   └──────┬──────┘  │
│       │               │                  │          │
│       └───────────────┴──────────────────┘          │
│                  tini (PID 1)                       │
│              reaps zombie processes                  │
└─────────────────────────────────────────────────────┘
         Port 8465 → REST API + Web Dashboard + /docs
```

- **Single port** — Vite frontend static assets are bundled at build time into `/app/frontend/dist`. FastAPI auto-detects and serves them.
- **Headed Chromium via Xvfb** — ChatGPT fingerprints headless browsers. Headed mode with a virtual display bypasses Cloudflare/Turnstile.
- **tini -g as PID 1** — Reaps orphaned Chromium renderer subprocesses. The `-g` flag broadcasts `SIGTERM` to the entire process group for clean shutdown.

---

## Building Locally

```bash
# Build multi-stage image (requires Docker 20.10+ for BuildKit)
DOCKER_BUILDKIT=1 docker build -t chatgpt-bridge:local .

# Run locally (useful for testing before pushing)
docker run -d \
  --name chatgpt-bridge-local \
  --shm-size=2gb \
  -p 8465:8465 \
  -v ./chatgpt_bridge_data:/data \
  chatgpt-bridge:local
```

---

## GitHub Actions CI/CD (Optional)

Push to `master` and the image is automatically built and pushed to GHCR:

```yaml
# .github/workflows/docker-publish.yml
on:
  push:
    branches: [master]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v5
        with:
          push: true
          tags: ghcr.io/jack101a/chatgpt-bridge-app:latest
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Target closed` / `SIGBUS` in logs | `/dev/shm` too small | Ensure `shm_size: "2gb"` is set |
| `Server is already active for display :99` | Stale X11 lock from crash | Container auto-cleans on restart; if persists, `docker restart chatgpt-bridge` |
| `The profile appears to be in use` | Stale Chromium `SingletonLock` | Entrypoint auto-cleans on start; or delete `/data/profile/Singleton*` |
| Container restarts every 45s | Health check failing | Check `/health` endpoint manually; verify no crash in `docker logs chatgpt-bridge` |
| OOM killed | Memory limit too low | Raise `deploy.resources.limits.memory` to `4G` or reduce concurrent users |
| `AuthError: session is not authenticated` | No cookies mounted | POST cookies to `/accounts` or copy `cookies.json` to `/data/` |

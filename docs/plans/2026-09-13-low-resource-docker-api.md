# Ultra-Low Resource Optimization, Universal REST API & Docker Standardization

> **Status**: Ready for Review & Execution  
> **Target Worktree**: `.worktrees/low-resource-docker-api` (Branch: `feature/low-resource-docker-api`)  
> **Primary Goal**: Slash resource consumption (RAM, CPU, GPU, Disk, Power), expose a universal REST API for any programming language (Python, Node.js, JS), and provide a standardized 1-command Docker deployment.

---

## 1. System Requirements & Design Goals

### Resource Targets
| Metric | Current Baseline | Optimized Target |
| :--- | :--- | :--- |
| **Idle RAM** | ~800 MB | **~25 MB** (Bot & HTTP API only, browser asleep) |
| **Active Image RAM** | ~800 MB | **~220 MB – 260 MB** |
| **Idle CPU / Power** | 1–3% background spikes | **0.0%** (zero timers or service workers running) |
| **GPU / 3D Emulation** | Active (SwiftShader 3D process) | **Disabled completely** (`--disable-gpu`) |
| **Display Resolution** | 1920×1080 (2.07M pixels) | **1024×768** (0.78M pixels, -62% rendering load) |
| **Disk Profile Cache** | 766 MB | **< 120 MB** (capped cache & auto-prune) |

### Functional Targets
1. **Universal REST API**:
   - Serve a FastAPI service with CORS enabled on `0.0.0.0:8765`.
   - Full Swagger UI interactive docs at `http://localhost:8765/docs`.
   - Endpoints:
     - `GET /health` & `GET /status`
     - `POST /ask` (Text chat with continuity)
     - `POST /image` (DALL-E generation with automatic retry & pencil edit)
     - `POST /conversations/new` (Thread reset)
     - `DELETE /conversations/{id}`
     - `GET /images/{filename}` (Serve generated images directly over HTTP)
2. **Dual-Mode Container**:
   - If `TELEGRAM_BOT_TOKEN` is set: runs both the Telegram bot and the REST API concurrently.
   - If `TELEGRAM_BOT_TOKEN` is empty: runs purely as a headless ChatGPT REST API microservice.
3. **Multi-Language Client Examples**:
   - Python client (`requests` / `httpx`)
   - Node.js / JavaScript client (`fetch` / `axios`)
   - Standard `curl` snippets
4. **Isolated Worktree Verification**:
   - Build, benchmark, and verify all tests inside `.worktrees/low-resource-docker-api` before merging back into `master`.

---

## 2. File Map

### New Files to Create:
* `python/chatgpt_bridge/api.py`: Enhanced FastAPI server with CORS, image static file serving, and full endpoints.
* `Dockerfile`: Lean, multi-stage container image based on `python:3.11-slim-bookworm` with Playwright Chromium & Xvfb.
* `docker-compose.yml`: Standard 1-command deployment with volume persistence.
* `docker-entrypoint.sh`: Container entrypoint handling Xvfb display, cookie verification, API daemon, and optional Telegram bot.
* `examples/client_python.py`: Python client demonstrating `/ask` and `/image` with conversation continuity.
* `examples/client_node.js`: Node.js client demonstrating chat and image generation.
* `examples/curl_examples.sh`: Simple shell scripts for quick testing.
* `tests/test_api.py`: Automated tests for the REST API endpoints.

### Existing Files to Modify:
* `python/chatgpt_bridge/browser.py`:
  - Add ultra-lean Chromium launch flags (`--disable-gpu`, `--disable-software-rasterizer`, `--mute-audio`, `--js-flags="--max-old-space-size=128"`, `--renderer-process-limit=1`, `--disk-cache-size=33554432`).
  - Add configurable viewport dimension (`1024x768` default).
  - Add idle sleep timer (`close_after_idle_seconds`) to automatically shut down browser process after inactivity.
* `python/chatgpt_bridge/core.py`:
  - Support on-demand browser startup and idle shutdown.
* `python/chatgpt_bridge/bot.py`:
  - Use configurable screen resolution and lower default retry budget (default 4 retries).
* `README.md`:
  - Complete guide for Docker deployment, REST API usage, and Telegram bot setup.

---

## 3. Step-by-Step Implementation Tasks

### Task 1: Chromium Ultra-Low Resource Flags & Viewport
- [ ] In `python/chatgpt_bridge/browser.py`, update `BrowserManager` flags:
  - Add `--disable-gpu`, `--disable-software-rasterizer`, `--mute-audio`, `--disable-audio-output`.
  - Add `--js-flags="--max-old-space-size=128 --optimize-for-size"`.
  - Add `--renderer-process-limit=1`.
  - Add `--disk-cache-size=33554432` (32 MB disk cache).
  - Update default viewport to `{"width": 1024, "height": 768}`.
- [ ] Verify unit tests and test browser launch with new flags.

### Task 2: Idle Browser Sleep & Standby Engine
- [ ] Implement `idle_timeout` in `core.py` / `browser.py`:
  - When an `/image` request completes, start an inactivity timer (e.g., 300 seconds).
  - If no new browser-dependent requests arrive, call `await browser.close()`.
  - On the next `/image` call, auto-awaken the browser seamlessly.
- [ ] Measure idle RAM drops from ~800 MB down to ~25 MB.

### Task 3: Universal FastAPI Server (`api.py`)
- [ ] Build `python/chatgpt_bridge/api.py`:
  - Mount static route `/images` to serve generated images over HTTP.
  - Add `GET /status`, `POST /ask`, `POST /image`, `POST /conversations/new`, `DELETE /conversation/{id}`.
  - Enable `CORSMiddleware` (allow all origins `*` for easy client integration).
  - Add Pydantic schemas with full validation and error mapping.
- [ ] Write integration test in `tests/test_api.py`.

### Task 4: Standardized Docker Container & Compose
- [ ] Create `Dockerfile`:
  - Base: `python:3.11-slim-bookworm`.
  - Install runtime dependencies: `xvfb`, `ca-certificates`, and Chromium library dependencies.
  - Install Python dependencies and Playwright Chromium binary (`playwright install chromium`).
  - Set up volume `/data` for cookies, session profile, and images.
- [ ] Create `docker-entrypoint.sh`:
  - Auto-start Xvfb on display `:99` with `1024x768x16`.
  - Auto-import `/data/cookies.json` or `/data/cookies.txt` if present.
  - Start FastAPI daemon on `0.0.0.0:8765`.
  - If `TELEGRAM_BOT_TOKEN` is present, also start `chatgpt_bridge.bot` as a background worker.
- [ ] Create `docker-compose.yml` with clear environment variable documentation.

### Task 5: Client SDK Examples & Docs
- [ ] Write `examples/client_python.py`.
- [ ] Write `examples/client_node.js`.
- [ ] Write `examples/curl_examples.sh`.
- [ ] Update `README.md` with full API reference and Docker quickstart instructions.

### Task 6: Comprehensive Verification in Worktree & Merge
- [ ] Test API endpoints via curl and Python client in `.worktrees/low-resource-docker-api`.
- [ ] Test Telegram bot in worktree with test prompt.
- [ ] Benchmark resource consumption (CPU, RAM, Disk).
- [ ] Commit all changes to `feature/low-resource-docker-api`.
- [ ] Fast-forward merge `feature/low-resource-docker-api` into `master`.
- [ ] Push to git remote.

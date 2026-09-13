# Companion Dashboard Implementation Plan

> Implement a zero-overhead Web UI companion dashboard served directly by FastAPI daemon on port 8465 without additional containers or Node.js dependencies.

## Architecture & Scope
- Single-page application bundle `python/chatgpt_bridge/dashboard.html` using Tailwind CSS CDN + Alpine.js.
- FastAPI endpoints in `python/chatgpt_bridge/daemon.py` (`/`, `/dashboard`, `/api/gallery*`, `/api/chats*`, `/api/accounts/cookies`, `/api/settings`, `/api/telemetry`, `/ws/events`).
- Self-healing image metadata sidecar `gallery_index.json` and persistent favorites `favorites.json`.
- Zero lock contention: dashboard reads hit small JSON files, keeping the UI responsive even during active image generation.

## Tasks

- [x] Task 1: Create `python/chatgpt_bridge/dashboard.html` extracted from `docs/KIMI_DASHBOARD_UIUX_SPEC.md`.
- [x] Task 2: Extend `python/chatgpt_bridge/daemon.py` with dashboard API models, sidecar indexing, endpoints, and WebSocket broadcasting.
- [x] Task 3: Add unit tests in `python/tests/test_dashboard_api.py` covering all new API endpoints, edge cases, and WebSocket broadcast.
- [x] Task 4: Run full test suite `PYTHONPATH=python python/.venv/bin/pytest python/tests -q` to ensure zero regressions across existing tests and all new tests pass (186 passed).
- [x] Task 5: Manual verification with live HTTP client requests on daemon server endpoints.

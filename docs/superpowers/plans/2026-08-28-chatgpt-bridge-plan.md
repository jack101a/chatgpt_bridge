# chatgpt-bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Python library + JS client letting other projects prompt ChatGPT (web session via Playwright/CDP hybrid) for text and images.

**Architecture:** Python core owns a persistent Playwright Chromium profile; steals session tokens via CDP for fast direct `backend-api` HTTP calls; UI-driving fallback when HTTP shape drifts; image gen via UI. JS talks to a FastAPI daemon wrapping the same core on `127.0.0.1:8765`.

**Tech Stack:** Python ≥3.11, playwright, httpx, fastmcp→(no), fastapi, uvicorn, pydantic. Node ≥18, native fetch.

## Global Constraints
- Project root: `/home/aiuser/projects/chatgptmcp`
- Python package dir: `python/chatgpt_bridge/`; JS dir: `js/`
- State dir: `~/.chatgpt-bridge/` (`profile/`, `cookies.txt|json`, `images/`, `daemon.json`)
- No streaming, no history mgmt, no MCP (per spec `docs/superpowers/specs/2026-08-28-chatgpt-bridge-design.md`)
- Commit after each task: `feat(core): ...`

---

### Task 1: Scaffold + cookie parsing

**Files:**
- Create: `python/pyproject.toml`
- Create: `python/chatgpt_bridge/__init__.py` (placeholder: `__version__ = "0.1.0"`)
- Create: `python/chatgpt_bridge/cookies.py`
- Create: `python/tests/test_cookies.py`

**Produces:**
- `load_cookie_file(path: str) -> list[dict]` — accepts Netscape .txt or JSON array, returns playwright-style cookies `[{name,value,domain,path,expires,secure,httpOnly,sameSite}]`.
- `cookies_valid(cookies) -> bool` — returns True iff a `__Secure-next-auth.session-token` cookie exists and is unexpired.

**Implementation notes:**
```python
# cookies.py core behavior:
def load_cookie_file(path):
    # .json -> parse list[{name,value,domain,...}]; normalize missing fields:
    #   domain default "chatgpt.com" with leading "." if absent; path "/";
    #   expires -1 if absent; secure=True; sameSite "Lax"
    # .txt -> Netscape format: skip '#'/blank; 7 tab-fields:
    #   domain, tailmatch, path, secure, expires, name, value
def cookies_valid(cookies):
    now = time.time()
    for c in cookies:
        if c["name"] == "__Secure-next-auth.session-token":
            exp = c.get("expires", -1)
            if exp == -1 or exp > now:
                return True
    return False
```
- Tests construct fixture cookies inline (no real secrets): valid/⁠expired/missing-session-token/⁠bad-format cases. Use pytest tmp_path for file fixtures.
- Steps: write failing test → `cd python && python -m pytest tests/test_cookies.py -v` (fail) → implement → pass → commit.

---

### Task 2: Browser + session manager

**Files:**
- Create: `python/chatgpt_bridge/browser.py`
- Create: `python/chatgpt_bridge/session.py`
- Create: `python/tests/test_session.py` (unit only; live checks stay manual)

**Interfaces (later tasks consume exactly these):**
```python
# browser.py
class BrowserManager:
    def __init__(self, headless: bool = True): ...
    async def start(self) -> None   # launch persistent context at STATE_DIR/"profile"
    async def context(self)         # returns playwright BrowserContext (starts if needed)
    async def ensure_logged_in(self) -> None  # raises AuthError on failure paths
    async def stop(self) -> None

# session.py
class SessionManager:
    def __init__(self, browser: BrowserManager): ...
    async def is_alive(self) -> bool          # GET /api/auth/session via page/request
    async def get_access_token(self) -> str   # parse from /api/auth/session JSON
    async def get_cookies(self) -> list[dict]
    def import_cookie_file(self, path: str) -> None  # uses cookies.load_cookie_file;
        # marks pending import applied into context on next start (context.add_cookies)
```

**Auth priority (login_flow):** existing profile alive → import cookie file if present → interactive headful relaunch (user logs in, press-Enter-in-console wait, profile persists).

**AuthError:** define in `python/chatgpt_bridge/errors.py` — `class AuthError(RuntimeError)`; also `ShapeChangedError(RuntimeError)`, `BridgeTimeoutError(TimeoutError)`, `DaemonUnreachableError(RuntimeError)`.

- Steps: test for import-pending flag + error classes (headless-free logic); implement; run pytest; commit.
- Playwright install: `pip install playwright httpx fastapi uvicorn pytest && python -m playwright install chromium`.

---

### Task 3: HTTP client (fast path)

**Files:**
- Create: `python/chatgpt_bridge/http_client.py`
- Create: `python/tests/test_http_client.py`

**Interface:**
```python
class BackendClient:
    def __init__(self, session: SessionManager): ...
    async def ask(self, prompt: str, conversation_id: str | None = None) -> dict
    # returns {"text": str, "conversation_id": str}
    # raises ShapeChangedError on non-200/parse failure/unknown payload
```

**Implementation sketch:** POST `https://chatgpt.com/backend-api/conversation` with headers `Authorization: Bearer <access_token>`, cookies from session, body:
```json
{"action":"next","messages":[{"id":"<uuid4>","author":{"role":"user"},"content":{"content_type":"text","parts":[prompt]}}],
 "parent_message_id":"<uuid4>","model":null,"conversation_id":null}
```
Response is SSE-style lines; collect `message.content.parts[0]` from final `data:` JSON with `message.status == "finished_successfully"`; read `conversation_id`. Treat anything unexpected → `ShapeChangedError` (fallback handles). Add UA header matching Chrome.

- Unit tests: feed canned SSE blobs (valid, truncated, error-json) via `httpx.MockTransport`; assert parse + error mapping. Commit.

---

### Task 4: UI driver (fallback + image gen)

**Files:**
- Create: `python/chatgpt_bridge/ui_driver.py`
- Create: `python/chatgpt_bridge/images.py`
- Create: `python/tests/test_images.py` (pure-logic: filename/stamping, poll-loop state machine via fake page)

**Interfaces:**
```python
# ui_driver.py
class UIDriver:
    def __init__(self, browser: BrowserManager, session: SessionManager): ...
    async def ask(self, prompt: str, conversation_id: str | None = None) -> dict
    async def generate_image(self, prompt: str, timeout_s: int = 180) -> dict

# images.py
async def wait_for_image(page, timeout_s: int) -> str   # → image element src
async def save_image(src: str, out_dir: Path, ctx) -> Path  # download (data/blob/url) → file
```

**UI flow (robust-ish selectors, data-testid-first):**
- Open `https://chatgpt.com/` (+ `?model=&conversation=`) in context page.
- Composer: `[data-testid="composer-text-input"], div[contenteditable="true"]`. Fill prompt, press Enter (or click `[data-testid="composer-send-button"]`).
- Answer: poll assistant turn blocks (`article` / `[data-message-author-role="assistant"]`); done when composer send button re-enabled + text stable 2 polls.
- Image: wait for `article img[src*="oaiusercontent"]` or markdown image in last assistant turn; fetch with request context (handles signed URLs / blobs).
- Return shapes same as http_client (`{"text","conversation_id"}`) and `{"path","prompt"}`.

---

### Task 5: Public core API + daemon

**Files:**
- Create: `python/chatgpt_bridge/core.py`
- Create: `python/chatgpt_bridge/daemon.py`
- Modify: `python/chatgpt_bridge/__init__.py` → `from .core import ChatGPT`

**Interfaces:**
```python
class ChatGPT:
    def __init__(self, headless: bool = True, auto_relogin: bool = False): ...
    async def ask(self, prompt, model=None, conversation_id=None) -> dict
    #   try BackendClient.ask → ShapeChangedError → UIDriver.ask
    async def generate_image(self, prompt, timeout_s=180) -> dict  # UIDriver only
    def close(self)
```
Plus sync sugar: `ask_sync = lambda self,...: asyncio.run(self.ask(...))`.

**daemon.py:** FastAPI app, `GET /health` → `{"ok":true}`; `POST /ask` body `{prompt,model?,conversation_id?}`; `POST /image` body `{prompt,timeout_s?}`; errors → 502 with `{error: {type,message}}`. On boot writes `STATE_DIR/daemon.json` = `{"pid":..,"port":8765}`; run via `python -m chatgpt_bridge.daemon`. asyncio.Lock serialize requests (single tab).

- Smoke test daemon with uvicorn TestClient mocking core. Commit.

---

### Task 6: JS client

**Files:**
- Create: `js/package.json` (`name:"chatgpt-bridge", "type":"module", "main":"index.js"`)
- Create: `js/index.js`
- Create: `js/daemon.js`

**Interfaces:**
```js
export class ChatGPT {
  constructor({ baseUrl } = {})        // default http://127.0.0.1:8765
  async ask(prompt, opts = {})         // POST /ask → {text, conversationId}
  async generateImage(prompt, opts={}) // POST /image → {path, prompt}
}
```
`daemon.js`: read `~/.chatgpt-bridge/daemon.json`; fetch `/health` (1.5 s timeout); if dead → spawn detached `python -m chatgpt_bridge.daemon` (stdio `ignore` + log file `STATE_DIR/daemon.log`), poll health up to 30 s; else throw `Error("daemon unreachable")`. Node ≥18 native fetch; no deps.
- Test: `node js/smoke.mjs` against mocked `npx http-server`? No — ship `js/smoke.mjs` manual script only; unit test unnecessary. Commit.

---

### Task 7: End-to-end manual verification

- [ ] `pip install -e ./python` + `playwright install chromium`
- [ ] Cookie path: export cookies.json, delete profile, `python -c "..."` ask works
- [ ] Interactive path: fresh state, headful login, ask() returns real text
- [ ] `generate_image("a fox at sunset")` → PNG saved under `~/.chatgpt-bridge/images/`
- [ ] Kill nothing: run `node js/smoke.mjs` — daemon auto-spawns, ask works from JS
- [ ] Break test: corrupt profile → clear `AuthError` message
- [ ] Commit + final spec check vs `docs/superpowers/specs/2026-08-28-chatgpt-bridge-design.md`

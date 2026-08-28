# chatgpt-bridge — Design Spec

Date: 2026-08-28
Status: Approved direction, details below.

## 1. Goal
Embeddable library that lets other Python and JavaScript projects prompt ChatGPT
(web account session, not paid API) and receive text answers and generated images.

## 2. Auth model (user selected: web session via Playwright + CDP hybrid)
ChatGPT web account session reused across runs. Two login paths, either is valid:

- **Interactive once** — headful Chromium opens, user logs in manually once,
  persistent profile saves session at `~/.chatgpt-bridge/profile/`.
- **Cookie injection** — user exports cookies from their real browser
  (e.g. via "Get cookies.txt" / DevTools) for `chatgpt.com` / `openai.com`,
  places file at `~/.chatgpt-bridge/cookies.txt` (Netscape cookie format) or
  `~/.chatgpt-bridge/cookies.json` (array of {name, value, domain, path, expires}).
  On startup, if profile missing/stale, cookies imported into Playwright context
  and validated by hitting the session endpoint. Key cookie:
  `__Secure-next-auth.session-token`.

Priority: existing valid profile > cookie import > interactive login prompt.

## 3. Architecture

Core is a Python package. JavaScript consumers use a thin npm client that talks
to the Python core over a locally-spawned HTTP daemon.

```
chatgpt-bridge/
├── python/chatgpt_bridge/
│   ├── __init__.py      — exports ChatGPT class
│   ├── core.py          — public API: ask(), generate_image()
│   ├── browser.py       — Playwright persistent-context manager, headful/headless
│   ├── session.py       — token/cookie harvest via CDP, validation, refresh
│   ├── cookies.py       — cookie file parse (Netscape + JSON), import, validation
│   ├── http_client.py   — direct calls to chatgpt.com backend-api using session
│   ├── ui_driver.py     — fallback: drive chatgpt.com DOM via Playwright
│   ├── images.py        — wait-for-image, download, save to out dir
│   └── daemon.py        — FastAPI wrapper exposing core as localhost HTTP
├── js/
│   ├── index.js         — ask(), generateImage(); talks to daemon
│   └── daemon.js        — spawn/health-check python daemon child process
├── python/pyproject.toml
├── js/package.json
└── docs/superpowers/specs/  (this file)
```

State layout (user home):
```
~/.chatgpt-bridge/
├── profile/        — Playwright persistent profile
├── cookies.txt|json— optional user-provided cookies
├── images/         — downloaded generated images
└── daemon.port     — daemon port + pid for JS client discovery
```

## 4. Request flow

### ask(prompt, model=None, conversation_id=None)
1. Ensure session alive (profile/cookies ok, session check passes).
2. Try **HTTP path**: POST to backend-api conversation endpoint using harvested
   tokens/cookies. Collect response, return text.
3. On shape error / unexpected status → one automatic retry via **UI path**:
   navigate chatgpt.com tab, fill composer, submit, poll for assistant message.
4. Return `{ text, conversation_id }`.

Streaming NOT required (v1 waits for completion). `model` optional; default is
whatever the account session defaults to. `conversation_id` passthrough allows
continuing a thread; no local history management (YAGNI).

### generate_image(prompt)
Image generation lives in the frontend flow → always UI path:
1. Open chat tab, submit prompt.
2. Poll for generated image element (timeout ~180 s, configurable).
3. Download full-size image, save to `~/.chatgpt-bridge/images/<ts>.png`.
4. Return `{ path, prompt }` (path also returned via HTTP for JS clients).

## 5. Errors
- `AuthError` — session invalid; message says re-login or refresh cookies.
  Optional `auto_relogin=True` opens headful browser at that point.
- `ShapeChangedError` — HTTP path broke; internal, triggers UI fallback.
  If UI also fails with unknown DOM → raises with diagnostic note.
- `TimeoutError` — image gen exceeded wait limit.
- Daemon not reachable (JS side) → client attempts one spawn, then raises.

## 6. JS client API
```js
import { ChatGPT } from 'chatgpt-bridge';
const g = new ChatGPT();          // spawns daemon if needed
await g.ask('summarize X');       // → { text, conversationId }
await g.generateImage('a fox');   // → { path, prompt }
```
Daemon lifecycle: client checks `~/.chatgpt-bridge/daemon.port` liveness;
if dead, spawns `python -m chatgpt_bridge.daemon` detached, waits for health.

## 7. Python API
```python
from chatgpt_bridge import ChatGPT
g = ChatGPT()
g.ask("hello")                    # → {"text": ..., "conversation_id": ...}
g.generate_image("a fox")         # → {"path": ..., "prompt": ...}
```

## 8. Non-goals (YAGNI)
- MCP server interface
- Streaming responses
- Multi-account / profile switching
- Conversation history storage
- Rate limiting / question queueing beyond simple lock

## 9. Risks
- ToS-gray area; account ban possible. Recommend secondary account.
- chatgpt.com DOM/API drift → HTTP path breaks without warning; UI fallback
  reduces blast radius. Cookie expiry requires periodic re-login/cookie refresh.

## 10. Verification
- Manual E2E on dev machine: login once (both paths), ask() returns real answer,
  generate_image() saves a real PNG, JS client round-trips through daemon.
- Unit tests: cookie parsers, error classification. Integration tests need live
  session → keep separate `tests/integration/` run manually.

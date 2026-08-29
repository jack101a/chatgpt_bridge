# chatgpt-bridge

Prompt ChatGPT (your logged-in web account) for **text** and **images** from
your own Python or JavaScript projects — no OpenAI API key required.

`chatgpt-bridge` is a **pure bridge**: it relays your prompts to ChatGPT and
returns the answers/images. It does **not** impose any tone, style, language,
or content policy — you (or your program) decide what to write.

## How it works

- **Python core** (`python/chatgpt_bridge/`) drives a persistent Playwright
  Chromium profile and uses a hybrid strategy:
  - **Fast path** — direct HTTP calls to ChatGPT's `backend-api` using the
    session token harvested from your browser.
  - **UI fallback** — drives the real `chatgpt.com` DOM when the HTTP shape
    drifts or for image generation.
- **JS client** (`js/`) is a thin, dependency-free wrapper that talks to a
  local FastAPI daemon on `127.0.0.1:8765` (auto-spawned on first use).
- **Auto chat cleanup** — every turn creates a new chat; the bridge keeps a
  bounded pool and soft-deletes the **oldest** chat once the pool exceeds
  `max_chats` (default 10), so your account never fills up.

## Authentication

The bridge uses your **logged-in ChatGPT web session**, not the paid API.
Auth is resolved in this priority order:

1. **Existing live profile** — a previously logged-in browser profile at
   `~/.chatgpt-bridge/profile`.
2. **Cookie import** — a cookie file at `~/.chatgpt-bridge/cookies.txt`
   (Netscape format) or `~/.chatgpt-bridge/cookies.json` (JSON array, e.g. a
   Chrome "Cookie-Editor" export). The key cookie is
   `__Secure-next-auth.session-token`.
3. **Interactive login** — a headful browser opens for you to log in manually
   (only when `auto_relogin=True`).

> **Tip:** export your ChatGPT cookies with a browser extension (e.g.
> "Cookie-Editor"), save them to `~/.chatgpt-bridge/cookies.txt`, and the
> bridge will log in automatically.

## Python usage

```bash
cd python
pip install -e .
python -m playwright install chromium
```

```python
from chatgpt_bridge import ChatGPT

gpt = ChatGPT(headless=False)          # headful (headless is Cloudflare-blocked)

# Ask a question
result = gpt.ask_sync("Write a one-sentence product description for a coffee mug.")
print(result["text"])                  # the answer
print(result["conversation_id"])       # the chat id

# Generate an image
img = gpt.generate_image_sync("a simple red circle on white background")
print(img["path"])                     # path to the saved PNG

gpt.close()
```

Async is also supported:

```python
import asyncio
from chatgpt_bridge import ChatGPT

async def main():
    gpt = ChatGPT(headless=False)
    result = await gpt.ask("What is an API?")
    print(result["text"])
    await gpt.browser.stop()

asyncio.run(main())
```

### Constructor options

| Param | Default | Description |
|-------|---------|-------------|
| `headless` | `True` | Run Chromium headless. **Set `False`** — headless is Cloudflare-blocked on most datacenter IPs. |
| `auto_relogin` | `False` | If `True`, open an interactive login window when no session is found. |
| `max_chats` | `10` | Max conversations kept in the pool; the oldest is soft-deleted past this. |

## JavaScript usage

```bash
cd js
npm install   # no runtime deps; just for the package metadata
```

```js
import { ChatGPT } from "./index.js";

const gpt = new ChatGPT();

const answer = await gpt.ask("Write a Twitter post about coffee.");
console.log(answer.text);

const image = await gpt.generateImage("a blue square");
console.log(image.path);
```

The JS client auto-spawns the Python daemon. Point it at your Python
interpreter if it isn't `python3` on `PATH`:

```bash
export CHATGPT_BRIDGE_PYTHON=/path/to/your/venv/bin/python
```

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CHATGPT_BRIDGE_STATE` | `~/.chatgpt-bridge` | State directory (profile, cookies, chat pool, images). |
| `CHATGPT_BRIDGE_HEADLESS` | `0` | Set `1` to force headless Chromium (only if headless passes Cloudflare on your box). |
| `CHATGPT_BRIDGE_PYTHON` | `python3` | Python interpreter the JS client uses to spawn the daemon. |

## HTTP daemon

The Python package also ships a FastAPI daemon (`python -m chatgpt_bridge.daemon`)
on `127.0.0.1:8765`:

- `GET /health` → `{"ok": true}`
- `POST /ask` → `{"prompt": "..."}` → `{"text", "conversation_id"}`
- `POST /image` → `{"prompt": "...", "timeout_s": 180}` → `{"path", "prompt"}`

## Requirements

- Python ≥ 3.10
- Node ≥ 18 (JS client only)
- A ChatGPT account (free or Plus) with a logged-in session

## Development

```bash
cd python
pip install -e ".[dev]"
pytest
```

## License

MIT — see [LICENSE](LICENSE).

## Disclaimer

This project is **not affiliated with OpenAI**. It drives your own logged-in
web session and is intended for personal/automation use. Use responsibly and
in accordance with ChatGPT's terms of service.
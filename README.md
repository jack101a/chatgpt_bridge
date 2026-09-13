# chatgpt-bridge

Prompt ChatGPT (your logged-in web account) for **text** and **images** from your own Python or JavaScript projects — no OpenAI API key required.

`chatgpt-bridge` is a **pure bridge**: it relays your prompts to ChatGPT and returns the answers and images. It does **not** impose any tone, style, language, or content policy — you (or your program) decide what to write.

---

## Key Highlights

- **Direct Web Session Automation**: Drives a persistent Playwright Chromium browser using your own ChatGPT web login.
- **In-Place Pencil-Edit Retry (10x)**: Instead of filling your history with failed retry turns, retries click the **Edit message** pencil icon and resend in place.
- **Instant Image Return (0 Redundant Retries)**: Watches the DOM in real-time. The moment an image renders, it returns immediately without burning further retries.
- **Full Multi-Turn Continuity**: Maintains exact conversation context across multiple turns for character/style consistency.
- **Rich Telegram Bot**: Long-polling bot with robust Markdown-to-Telegram-HTML conversion, syntax-highlighted code block preservation, and safe 4096-character chunking.
- **Progressive Delay & Safety Guards**: Follows exact progressive intervals (`5s, 10s, 15s, 20s, 25s, 26s, 27s, 28s, 29s, 30s`), auto-tweaks prompts on retries 6–10, and halts immediately on rate limits.

---

## Documentation

- 📖 [**Architecture & Technical Reference**](docs/ARCHITECTURE.md) — Internal system mechanics, state machines, DOM selectors, and component breakdown.
- 🎨 [**Image Generation & Continuity Guide**](docs/IMAGE_GENERATION_GUIDE.md) — Best practices for character consistency, angle changes, and retry tuning.
- 🤖 [**Telegram Bot Guide**](docs/TELEGRAM_BOT_GUIDE.md) — Setup, commands, whitelist configuration, and HTML message chunking.

---

## Authentication

The bridge uses your **logged-in ChatGPT web session**, not the paid API. Auth is resolved in this priority order:

1. **Existing live profile** — a previously logged-in browser profile at `~/.chatgpt-bridge/profile`.
2. **Cookie import** — a cookie file at `~/.chatgpt-bridge/cookies.txt` (Netscape format, `#HttpOnly_` supported) or `~/.chatgpt-bridge/cookies.json` (JSON array, e.g. a Chrome "Cookie-Editor" export). The key cookie is `__Secure-next-auth.session-token`.
3. **Interactive login** — a headful browser opens for you to log in manually (when `auto_relogin=True`).

> **Tip:** Export your ChatGPT cookies with a browser extension (e.g. "Cookie-Editor"), save them to `~/.chatgpt-bridge/cookies.txt`, and the bridge will authenticate automatically.

---

## Python Usage

```bash
cd python
pip install -e .
python -m playwright install chromium
```

### Basic Ask & Image Generation
```python
from chatgpt_bridge import ChatGPT

# Use headless=False (headless is Cloudflare-blocked on datacenter IPs)
gpt = ChatGPT(headless=False)

# 1. Ask a question
result = gpt.ask_sync("Write a one-sentence description of a rustic cottage.")
print(result["text"])
print(result["conversation_id"])

# 2. Generate an image
img = gpt.generate_image_sync("Generate image: Close-up portrait of an auburn-haired maiden")
print(img["path"])  # Local path to saved PNG

gpt.close()
```

### Async Multi-Turn Character Continuity
```python
import asyncio
from chatgpt_bridge import ChatGPT
from chatgpt_bridge.retry import RetryConfig

async def main():
    gpt = ChatGPT(headless=False)

    # Turn 1: Establish base character
    r1 = await gpt.generate_image(
        "Generate image: Rustic auburn-haired maiden in her 20s, freckles, braided hair, textured cottage dress, close-up POV",
        retry=RetryConfig(max_tries=10),
    )
    cid = r1["conversation_id"]
    print(f"Turn 1 Image: {r1['path']} (Thread: {cid})")

    # Turn 2: Change camera angle inside the SAME conversation thread
    r2 = await gpt.generate_image(
        "Generate image: Low-angle camera shot looking upward, rustic cottage interior background",
        conversation_id=cid,
        retry=RetryConfig(max_tries=10),
    )
    print(f"Turn 2 Image: {r2['path']} (Thread: {cid})")

    await gpt.aclose()

asyncio.run(main())
```

---

## Image Retry Engine

When ChatGPT refuses an image prompt or encounters transient errors:

1. **Real-Time Generation Tracking**: Inspects Stop buttons (`button[data-testid="stop-button"]`) and tool status states. Never bails out prematurely during DALL-E rendering.
2. **Immediate Success Advance**: On every 0.5s poll cycle, checks for new estuary image IDs. If an image is present, it returns immediately.
3. **Pencil-Edit Retry**:
   - Clicks the user message pencil icon (`button[aria-label="Edit message"]`) and re-submits in place.
   - **Retries 1–5**: Re-submits the original prompt with progressive backoffs (`5s, 10s, 15s, 20s, 25s`).
   - **Retries 6–10**: Automatically switches to the `tweaked_prompt` (if provided) to bypass false safety flags while preserving meaning.
4. **Rate Limit Guard**: Immediate test halt if quota or rate limit warnings are encountered.

---

## Telegram Bot

A standalone, long-polling Telegram bot that exposes ChatGPT text and image generation.

### Setup & Run
```bash
cd python
export TELEGRAM_BOT_TOKEN="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
export TELEGRAM_ALLOWED_USER_IDS="123456789"

# Run with virtual screen on headless Linux servers
xvfb-run -a -s "-screen 0 1920x1080x24" .venv/bin/python -m chatgpt_bridge.bot
```

### Commands:
- `<any message>` — Conversational chat in the active thread.
- `/image <prompt>` — Generates image and sends full-resolution photo.
- `/status` — Session alive state, browser status, chat pool size.
- `/chats` — List tracked conversations in rotation pool.
- `/clear` — Soft-delete tracked chats.

---

## JavaScript Usage

The JS client (`js/`) is a lightweight client communicating with the local FastAPI daemon on `127.0.0.1:8765`.

```bash
cd js
npm install
```

```javascript
import { ChatGPT } from "./index.js";

const gpt = new ChatGPT();
const answer = await gpt.ask("Hello ChatGPT!");
console.log(answer.text);

const image = await gpt.generateImage("A cute red panda wearing glasses");
console.log(image.path);
```

---

## Configuration & Environment Variables

| Variable | Default | Description |
| :--- | :--- | :--- |
| `CHATGPT_BRIDGE_STATE` | `~/.chatgpt-bridge` | State directory for profile, cookies, and saved images. |
| `CHATGPT_BRIDGE_HEADLESS` | `0` | Set `1` for headless mode (keep `0` if Cloudflare blocks headless). |
| `CHATGPT_BRIDGE_PYTHON` | `python3` | Python binary used by the JS client to spawn the daemon. |
| `TELEGRAM_BOT_TOKEN` | — | Token provided by @BotFather. |
| `TELEGRAM_ALLOWED_USER_IDS` | — | Comma-separated allowed Telegram user IDs. |

---

## Testing & Quality Control

The repository maintains an automated test suite covering all modules:

```bash
cd python
.venv/bin/pytest tests/
```

```
======================= 126 passed in ~50s =======================
```

---

## License

MIT — see [LICENSE](LICENSE).

## Disclaimer

This project is **not affiliated with OpenAI**. It automates your own logged-in personal web session. Use responsibly in compliance with ChatGPT terms of service.
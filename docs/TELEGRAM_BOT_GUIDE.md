# Telegram Bot Setup & Formatting Reference

The `chatgpt-bridge` Telegram bot allows you to interact with ChatGPT and generate images directly from your personal Telegram messenger, with zero dependencies on the paid OpenAI API.

---

## 1. Features

- **Conversational Text**: Direct chat relay with rich ChatGPT formatting.
- **Image Generation (`/image <prompt>`)**: Triggers the 10x in-place pencil-edit retry engine; delivers full-resolution photos directly into the chat.
- **Rich Markdown to Telegram HTML**: Converts standard Markdown headers, code blocks, bold, italics, strikethrough, and blockquotes to valid Telegram HTML.
- **Code Block Integrity & Safe Chunking**: When ChatGPT outputs code exceeding Telegram's 4096-character limit, the bot intelligently chunks text along tag boundaries, ensuring no broken `<pre><code>` blocks.
- **Typing & Upload Status Heartbeats**: Keeps the chat active with "typing..." and "sending photo..." indicators during long generations.
- **Whitelist Security**: Only user IDs specified in `TELEGRAM_ALLOWED_USER_IDS` can interact; unauthorized users are silently ignored.

---

## 2. Quickstart

### 2.1 Get Credentials
1. Message [@BotFather](https://t.me/BotFather) on Telegram and run `/newbot` to create your bot and obtain your `TELEGRAM_BOT_TOKEN`.
2. Message [@userinfobot](https://t.me/userinfobot) to get your numeric Telegram user ID.

### 2.2 Launch the Bot
```bash
cd /home/ubuntu/antigravity/radiant-newton/python

export TELEGRAM_BOT_TOKEN="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
export TELEGRAM_ALLOWED_USER_IDS="123456789,987654321"

# Run under virtual environment with virtual display (if on a headless server)
xvfb-run -a -s "-screen 0 1920x1080x24" .venv/bin/python -m chatgpt_bridge.bot
```

---

## 3. Bot Commands

| Command | Action |
| :--- | :--- |
| `<any message>` | Sends prompt to ChatGPT in the active conversation thread. Replies with formatted HTML. |
| `/image <prompt>` | Generates an image using DALL-E, saves the high-resolution file, and uploads it as a photo. |
| `/status` | Displays ChatGPT login status, active browser state, and chat pool statistics. |
| `/chats` | Lists active conversations in the local rotation pool. |
| `/clear` | Cleans up and soft-deletes tracked chats from the ChatGPT account. |
| `/help` | Displays command reference and usage tips. |

---

## 4. Markdown to HTML Conversion Details

Telegram does not support full standard Markdown and frequently errors out if entities are unescaped in `MarkdownV2`. The bot instead uses a custom HTML parser (`python/chatgpt_bridge/bot.py`):

1. **Fenced Code Blocks**:
   ```markdown
   ```python
   def hello():
       print("world")
   ```
   ```
   Becomes:
   ```html
   <pre><code class="language-python">def hello():
       print("world")</code></pre>
   ```
2. **Inline Code**: `` `code` `` becomes `<code>code</code>`.
3. **Bold / Italic**: `**bold**` $\to$ `<b>bold</b>`, `*italic*` $\to$ `<i>italic</i>`.
4. **HTML Entity Escaping**: Automatically escapes `&`, `<`, and `>` outside of formatted tags to prevent parse errors.
5. **Smart Splitting**: If a message exceeds 4096 characters, the splitter searches for the nearest newline or block boundary, automatically closing open `<pre>` tags on the split chunk and re-opening them on the next chunk.

"""Telegram bot frontend for chatgpt-bridge.

Standalone process — long polling against the Bot API over plain httpx
(no new dependencies). Run:

    TELEGRAM_BOT_TOKEN=123:abc TELEGRAM_ALLOWED_USER_IDS=111,222 \
        python -m chatgpt_bridge.bot

The bot owns an in-process ChatGPT instance. Do NOT run the HTTP daemon at
the same time — both own the same Chromium profile.

Access control: `TELEGRAM_ALLOWED_USER_IDS` is a comma-separated whitelist of
numeric Telegram user IDs. Missing/empty = deny everyone (fail closed).
Unlisted users are silently ignored.

UX: inline keyboards + a `/` command menu. Tap Ask/Image to prime a prompt,
then send the prompt as the next message. Plain text with no pending action
is treated as an Ask prompt.
"""

from __future__ import annotations

import asyncio
import html
import json
import logging
import os
import re
import time
from pathlib import Path
from typing import Mapping

import httpx

from .cookies import (
    cookies_valid,
    is_cookie_content,
    looks_like_cookie_or_token,
    parse_cookie_text,
)
from .core import ChatGPT
from .errors import AuthError, BridgeTimeoutError, GenerationDeniedError
from .retry import auto_tweak_prompt

API = "https://api.telegram.org"

# Hard Telegram message limit; split longer answers into sequential messages.
MAX_MSG = 4096

# Pending-action TTL (seconds) for tap-to-prime prompt input.
PENDING_TTL = 300

log = logging.getLogger("chatgpt_bridge.bot")


# --------------------------------------------------------------------------- #
# Config
# --------------------------------------------------------------------------- #

class BotConfig:
    def __init__(
        self,
        token: str,
        allowed_user_ids: frozenset[int],
        allow_all: bool = False,
    ) -> None:
        self.token = token
        self.allowed_user_ids = allowed_user_ids
        self.allow_all = allow_all

    @classmethod
    def from_env(cls, env: Mapping[str, str] | None = None) -> "BotConfig":
        env = os.environ if env is None else env
        token = (env.get("TELEGRAM_BOT_TOKEN") or "").strip()
        if not token:
            raise SystemExit(
                "TELEGRAM_BOT_TOKEN is required — create a bot via @BotFather."
            )
        raw = (env.get("TELEGRAM_ALLOWED_USER_IDS") or "").strip()
        allow_all = raw == "*"
        ids = (
            frozenset()
            if allow_all
            else frozenset(
                int(x)
                for x in raw.split(",")
                if x.strip() and x.strip().isdigit()
            )
        )
        return cls(token=token, allowed_user_ids=ids, allow_all=allow_all)

    def allowed(self, user_id: int | None) -> bool:
        if user_id is None:
            return False
        if self.allow_all:
            return True
        if not self.allowed_user_ids:
            return False
        return user_id in self.allowed_user_ids


# --------------------------------------------------------------------------- #
# Thin Bot API client
# --------------------------------------------------------------------------- #

def esc(text: str) -> str:
    """Escape a string for Telegram HTML parse mode (only & < > need it)."""
    return html.escape(text, quote=False)


def markdown_to_telegram_html(text: str) -> str:
    """Convert standard Markdown to Telegram-compatible HTML.

    Converts code blocks, inline code, bold, italic, strikethrough, blockquotes,
    headings, links, and bullet points into native Telegram HTML, escaping literal
    HTML characters elsewhere.
    """
    if not text:
        return ""

    placeholders: dict[str, str] = {}

    def repl_code_block(m: re.Match) -> str:
        lang = (m.group("lang") or "").strip()
        code = m.group("code") or ""
        if code.endswith("\n"):
            code = code[:-1]
        escaped_code = html.escape(code, quote=False)
        if lang:
            tag = f'<pre><code class="language-{html.escape(lang, quote=True)}">{escaped_code}</code></pre>'
        else:
            tag = f"<pre><code>{escaped_code}</code></pre>"
        key = f"\x00CB_{len(placeholders)}\x00"
        placeholders[key] = tag
        return key

    # 1. Extract fenced code blocks (``` or ~~~), including unclosed ones at end
    code_block_pattern = re.compile(
        r"(?P<fence>`{3,}|~{3,})(?P<lang>[a-zA-Z0-9_+-]+)?\r?\n?(?P<code>[\s\S]*?)(?:(?P=fence)|\Z)",
    )
    text = code_block_pattern.sub(repl_code_block, text)

    # 2. Extract inline code (`code`)
    def repl_inline_code(m: re.Match) -> str:
        code = m.group(1)
        escaped = html.escape(code, quote=False)
        key = f"\x00IC_{len(placeholders)}\x00"
        placeholders[key] = f"<code>{escaped}</code>"
        return key

    inline_code_pattern = re.compile(r"`([^`\n]+)`")
    text = inline_code_pattern.sub(repl_inline_code, text)

    # 3. Escape HTML characters in remaining text
    text = html.escape(text, quote=False)

    # 4. Blockquotes: group consecutive lines starting with &gt; or >
    lines = text.splitlines()
    new_lines: list[str] = []
    in_quote = False
    quote_buf: list[str] = []

    for line in lines:
        m = re.match(r"^(?:&gt;|>)[ \t]?(.*)$", line)
        if m:
            in_quote = True
            quote_buf.append(m.group(1))
        else:
            if in_quote:
                new_lines.append(f"<blockquote>{chr(10).join(quote_buf)}</blockquote>")
                quote_buf = []
                in_quote = False
            new_lines.append(line)
    if in_quote:
        new_lines.append(f"<blockquote>{chr(10).join(quote_buf)}</blockquote>")
    text = "\n".join(new_lines)

    # 5. Headers (# Header -> <b>Header</b>)
    text = re.sub(r"^(?:#{1,6})[ \t]+(.+?)[ \t]*$", r"<b>\1</b>", text, flags=re.MULTILINE)

    # 6. Links: [text](url) -> <a href="url">text</a>
    text = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<a href="\2">\1</a>', text)

    # 7. Bold and Italic
    # ***bold italic***
    text = re.sub(r"\*\*\*(.+?)\*\*\*", r"<b><i>\1</i></b>", text)
    text = re.sub(r"___(.+?)___", r"<b><i>\1</i></b>", text)
    # **bold** or __bold__
    text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
    text = re.sub(r"__(.+?)__", r"<b>\1</b>", text)
    # *italic* or _italic_
    text = re.sub(r"\*([^*\n]+?)\*", r"<i>\1</i>", text)
    text = re.sub(r"(?<!\w)_([^_\n]+?)_(?!\w)", r"<i>\1</i>", text)
    # ~~strikethrough~~
    text = re.sub(r"~~(.+?)~~", r"<s>\1</s>", text)

    # 8. Lists / bullets
    text = re.sub(r"^[ \t]*[-*+][ \t]+(.*)$", r"• \1", text, flags=re.MULTILINE)

    # 9. Restore placeholders
    for key, val in placeholders.items():
        text = text.replace(key, val)

    return text


TAG_OR_ENTITY_RE = re.compile(r"(<!--.*?-->|<[^>]+>|&[a-zA-Z0-9#]+;|[^<&]+)", re.DOTALL)
START_TAG_RE = re.compile(r"^<([a-zA-Z0-9_-]+)(?:\s+[^>]*)?>$")
END_TAG_RE = re.compile(r"^</([a-zA-Z0-9_-]+)>$")


def _chunk(text: str) -> list[str]:
    """Split text into <=MAX_MSG chunks on paragraph boundaries.

    Ensures no HTML tag or entity is sliced, and any tags open at chunk boundaries
    are cleanly closed in the current chunk and reopened in the next chunk.
    If text has no HTML tags, maintains exact paragraph/character splitting up to MAX_MSG.
    """
    if len(text) <= MAX_MSG:
        return [text]

    # Fast path for plain text without HTML tags or entities
    if "<" not in text and "&" not in text:
        chunks: list[str] = []
        current = ""
        for para in text.split("\n"):
            while len(para) > MAX_MSG:
                if current:
                    chunks.append(current)
                    current = ""
                chunks.append(para[:MAX_MSG])
                para = para[MAX_MSG:]
            if len(current) + len(para) + 1 > MAX_MSG and current:
                chunks.append(current)
                current = para
            else:
                current = f"{current}\n{para}" if current else para
        if current:
            chunks.append(current)
        return chunks

    # HTML-aware chunking
    tokens = TAG_OR_ENTITY_RE.findall(text)
    chunks: list[str] = []
    open_tags: list[tuple[str, str]] = []
    current_tokens: list[str] = []
    current_len = 0
    safety_margin = 150
    target_limit = MAX_MSG - safety_margin

    def close_current_chunk() -> None:
        nonlocal current_tokens, current_len
        if not current_tokens:
            return
        closing = "".join(f"</{tag}>" for tag, _ in reversed(open_tags))
        current_tokens.append(closing)
        chunks.append("".join(current_tokens))
        reopen = "".join(full_tag for _, full_tag in open_tags)
        current_tokens = [reopen] if reopen else []
        current_len = len(reopen)

    for token in tokens:
        m_start = START_TAG_RE.match(token)
        m_end = END_TAG_RE.match(token)

        if m_start:
            tag_name = m_start.group(1).lower()
            if not token.endswith("/>"):
                open_tags.append((tag_name, token))
            current_tokens.append(token)
            current_len += len(token)
        elif m_end:
            tag_name = m_end.group(1).lower()
            for i in range(len(open_tags) - 1, -1, -1):
                if open_tags[i][0] == tag_name:
                    open_tags.pop(i)
                    break
            current_tokens.append(token)
            current_len += len(token)
        else:
            limit = target_limit if open_tags else MAX_MSG
            if current_len + len(token) <= limit:
                current_tokens.append(token)
                current_len += len(token)
            else:
                if token.startswith("&") and token.endswith(";"):
                    if current_tokens:
                        close_current_chunk()
                    current_tokens.append(token)
                    current_len += len(token)
                else:
                    remaining = token
                    while remaining:
                        limit = target_limit if open_tags else MAX_MSG
                        available = limit - current_len
                        if available <= 0:
                            close_current_chunk()
                            limit = target_limit if open_tags else MAX_MSG
                            available = limit - current_len

                        if len(remaining) <= available:
                            current_tokens.append(remaining)
                            current_len += len(remaining)
                            break

                        slice_part = remaining[:available]
                        split_idx = slice_part.rfind("\n\n")
                        if split_idx != -1:
                            split_idx += 2
                        else:
                            split_idx = slice_part.rfind("\n")
                            if split_idx != -1:
                                split_idx += 1
                            else:
                                split_idx = slice_part.rfind(" ")
                                if split_idx != -1:
                                    split_idx += 1
                                else:
                                    split_idx = available

                        take = remaining[:split_idx]
                        remaining = remaining[split_idx:]
                        current_tokens.append(take)
                        current_len += len(take)
                        close_current_chunk()

    if current_tokens and "".join(current_tokens).strip():
        closing = "".join(f"</{tag}>" for tag, _ in reversed(open_tags))
        current_tokens.append(closing)
        chunks.append("".join(current_tokens))

    return chunks


class TelegramAPI:
    def __init__(self, token: str, transport: httpx.AsyncBaseTransport | None = None) -> None:
        self._client = httpx.AsyncClient(
            base_url=f"{API}/bot{token}", timeout=75.0, transport=transport
        )

    async def _call(self, method: str, **payload) -> dict:
        resp = await self._client.post(f"/{method}", json=payload)
        data = resp.json()
        if not data.get("ok"):
            raise RuntimeError(f"telegram {method} failed: {data.get('description')}")
        return data["result"]

    async def get_updates(self, offset: int, timeout_s: int = 50) -> list[dict]:
        result = await self._call(
            "getUpdates",
            offset=offset,
            timeout=timeout_s,
            allowed_updates=["message", "callback_query"],
        )
        return list(result)

    async def set_my_commands(self, commands: list[dict]) -> None:
        await self._call("setMyCommands", commands=commands)

    async def send_message(
        self,
        chat_id: int,
        text: str,
        parse_mode: str = "HTML",
        reply_markup: dict | None = None,
    ) -> dict:
        """Send a message, chunking long text. Returns the last sent message."""
        chunks = _chunk(text)
        last: dict = {}
        for i, chunk in enumerate(chunks):
            payload: dict = {"chat_id": chat_id, "text": chunk, "parse_mode": parse_mode}
            # Only attach the keyboard to the final chunk.
            if reply_markup is not None and i == len(chunks) - 1:
                payload["reply_markup"] = reply_markup
            try:
                last = await self._call("sendMessage", **payload)
            except RuntimeError as exc:
                if parse_mode and "can't parse entities" in str(exc).lower():
                    log.warning(
                        "HTML parse error in sendMessage, falling back to plain text: %s",
                        exc,
                    )
                    plain_text = html.unescape(re.sub(r"<[^>]+>", "", chunk))
                    payload["text"] = plain_text
                    payload.pop("parse_mode", None)
                    last = await self._call("sendMessage", **payload)
                else:
                    raise
        return last

    async def edit_message_text(
        self,
        chat_id: int,
        message_id: int,
        text: str,
        parse_mode: str = "HTML",
        reply_markup: dict | None = None,
    ) -> None:
        payload: dict = {
            "chat_id": chat_id,
            "message_id": message_id,
            "text": text,
            "parse_mode": parse_mode,
        }
        if reply_markup is not None:
            payload["reply_markup"] = reply_markup
        try:
            await self._call("editMessageText", **payload)
        except RuntimeError as exc:
            # "message is not modified" is a no-op — ignore it.
            if "not modified" in str(exc):
                return
            if parse_mode and "can't parse entities" in str(exc).lower():
                log.warning(
                    "HTML parse error in editMessageText, falling back to plain text: %s",
                    exc,
                )
                plain_text = html.unescape(re.sub(r"<[^>]+>", "", text))
                payload["text"] = plain_text
                payload.pop("parse_mode", None)
                await self._call("editMessageText", **payload)
            else:
                raise

    async def answer_callback_query(
        self, callback_query_id: str, text: str = "", show_alert: bool = False
    ) -> None:
        await self._call(
            "answerCallbackQuery",
            callback_query_id=callback_query_id,
            text=text,
            show_alert=show_alert,
        )

    async def send_chat_action(self, chat_id: int, action: str = "typing") -> None:
        await self._call("sendChatAction", chat_id=chat_id, action=action)

    async def send_photo(
        self,
        chat_id: int,
        path: str | Path,
        caption: str = "",
        parse_mode: str = "HTML",
        reply_markup: dict | None = None,
    ) -> None:
        data: dict = {
            "chat_id": str(chat_id),
            "caption": caption,
            "parse_mode": parse_mode,
        }
        if reply_markup is not None:
            data["reply_markup"] = json.dumps(reply_markup)
        with open(path, "rb") as fh:
            resp = await self._client.post(
                "/sendPhoto",
                data=data,
                files={"photo": (Path(path).name, fh, "image/png")},
            )
        data_resp = resp.json()
        if not data_resp.get("ok"):
            if parse_mode and "can't parse entities" in (data_resp.get("description") or "").lower():
                log.warning(
                    "HTML parse error in sendPhoto, falling back to plain text: %s",
                    data_resp.get("description"),
                )
                plain_caption = html.unescape(re.sub(r"<[^>]+>", "", caption))
                data["caption"] = plain_caption
                data.pop("parse_mode", None)
                with open(path, "rb") as fh2:
                    resp = await self._client.post(
                        "/sendPhoto",
                        data=data,
                        files={"photo": (Path(path).name, fh2, "image/png")},
                    )
                data_resp = resp.json()
            if not data_resp.get("ok"):
                raise RuntimeError(f"telegram sendPhoto failed: {data_resp.get('description')}")

    async def get_file(self, file_id: str) -> dict:
        """Fetch file metadata from Telegram Bot API."""
        return await self._call("getFile", file_id=file_id)

    async def download_file(self, file_path: str) -> bytes:
        """Download raw binary/text file payload from Telegram Bot API."""
        url = f"https://api.telegram.org/file/bot{self.token}/{file_path}"
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            return resp.content

    async def close(self) -> None:
        await self._client.aclose()


# --------------------------------------------------------------------------- #
# Inline keyboards
# --------------------------------------------------------------------------- #

def _btn(label: str, data: str) -> dict:
    return {"text": label, "callback_data": data}


def _menu_keyboard(mode: str = "chat", max_retries: int = 10) -> dict:
    mode_label = "🎨 Switch to Image Mode" if mode == "chat" else "💬 Switch to Chat Mode"
    mode_target = "mode:image" if mode == "chat" else "mode:chat"
    return {
        "inline_keyboard": [
            [_btn("🎨 Generate Image", "menu:image"), _btn("🆕 New chat", "menu:new")],
            [_btn("👤 Accounts", "menu:accounts"), _btn(f"⚙️ Retries ({max_retries}x)", "menu:retries")],
            [_btn("📊 Status", "menu:status"), _btn(mode_label, mode_target)],
        ]
    }


def _home_keyboard() -> dict:
    return {"inline_keyboard": [[_btn("🏠 Menu", "menu:home")]]}


def _ask_footer() -> dict:
    return {
        "inline_keyboard": [
            [_btn("🎨 Generate as Image", "ask:to_image"), _btn("🔁 Ask again", "menu:ask")],
            [_btn("🆕 New chat", "menu:new"), _btn("🏠 Menu", "menu:home")],
        ]
    }


def _image_footer(retries: int = 10) -> dict:
    return {
        "inline_keyboard": [
            [_btn(f"🔄 Retry ({retries}x)", "retry:image"), _btn("🆕 New chat", "menu:new")],
        ]
    }


def _cancel_keyboard() -> dict:
    return {"inline_keyboard": [[_btn("✖ Cancel", "cb:cancel")]]}


def _clear_confirm_keyboard() -> dict:
    return {
        "inline_keyboard": [
            [_btn("🗑 Yes, clear all", "clear:confirm"), _btn("Cancel", "cb:cancel")]
        ]
    }


def _accounts_keyboard_quick() -> dict:
    return {
        "inline_keyboard": [
            [_btn("👤 View Accounts", "menu:accounts"), _btn("📊 Status", "menu:status")],
            [_btn("🏠 Menu", "menu:home")],
        ]
    }


# --------------------------------------------------------------------------- #
# Image intent detection
# --------------------------------------------------------------------------- #

_IMAGE_INTENT_PATTERNS = [
    r"^(?:can\s+you\s+)?(?:please\s+)?(?:draw|paint|sketch|render|generate|create|make)\s+(?:me\s+)?(?:an?\s+)?(?:image|photo|picture|portrait|painting|illustration|art|drawing|sketch|render)\s+of\b",
    r"^(?:can\s+you\s+)?(?:please\s+)?(?:draw|paint|sketch|render)\s+(?:a|an|the|me\s+a)\s+(?!conclusion\b)[a-zA-Z0-9_\s-]+\b",
    r"^(?:generate|create|make)\s+(?:an?\s+)?(?:image|photo|picture|portrait|illustration|drawing|render)\b",
    r"^(?:an?\s+)?(?:realistic|candid|cinematic|detailed|vintage|modern|macro|studio|aerial|color|colour|b&w|analog|digital)?\s*(?:photo|picture|image|portrait|illustration|drawing|painting|render)\s+of\b",
    r"^(?:(?:close[\s-]*up|macro|medium|wide|low[\s-]*angle|high[\s-]*angle|aerial|cinematic|full[\s-]*body)\s*)+(?:shot|view|angle|perspective|portrait|of)?\b",
    r"\b(?:same\s+(?:woman|girl|man|person|character|scene|subject)|from\s+another\s+angle|in\s+a\s+3/4\s+side\s+profile|from\s+behind|photorealistic|hyperrealistic|cinematic\s+lighting|8k\s+resolution)\b",
    r"\b(?:realistic\s+photo|candid\s+photo|dslr\s+shot|film\s+grain)\b",
]
_COMPILED_IMAGE_INTENT = [re.compile(p, re.IGNORECASE) for p in _IMAGE_INTENT_PATTERNS]


def is_image_intent(text: str) -> bool:
    """Detect whether user text is intended as an image generation prompt."""
    t = text.strip()
    if not t:
        return False
    if "with your words" in t.lower() or "with words" in t.lower():
        return False
    return any(p.search(t) for p in _COMPILED_IMAGE_INTENT)


# --------------------------------------------------------------------------- #
# Handlers
# --------------------------------------------------------------------------- #

MENU_TEXT = (
    "Hi — I'm your ChatGPT bridge.\n\n"
    "Ask a question, generate an image, or manage your chats below."
)

COMMANDS = [
    {"command": "image", "description": "Generate an image (10x auto-retries)"},
    {"command": "new", "description": "Start a fresh chat (FIFO 10-chat pool)"},
    {"command": "status", "description": "Show account status & rate limits"},
    {"command": "accounts", "description": "Manage & switch ChatGPT accounts"},
    {"command": "retries", "description": "View / set max generation retries"},
    {"command": "retry", "description": "Retry last image"},
    {"command": "mode", "description": "Toggle Chat / Image mode"},
    {"command": "menu", "description": "Show the main menu"},
    {"command": "help", "description": "Show help"},
]


class BridgeBot:
    """Telegram → chatgpt-bridge command dispatcher with inline-keyboard UX."""

    def __init__(self, tg: TelegramAPI, config: BotConfig, gpt: ChatGPT) -> None:
        self.tg = tg
        self.config = config
        self.gpt = gpt
        self._lock = asyncio.Lock()
        # pending action per user: {user_id: ("ask"|"image"|..., timestamp)}
        self._pending: dict[int, tuple[str, float]] = {}
        # active mode per user: {user_id: "chat"|"image"}
        self._user_modes: dict[int, str] = {}
        # last prompts for easy 1-click retry:
        self._last_prompt: dict[int, str] = {}
        self._last_image_prompt: dict[int, str] = {}
        # pending cookies cache for account selection
        self._pending_cookies: dict[int, str] = {}
        # buffer for split multi-chunk cookie messages
        self._cookie_buffer: dict[int, str] = {}
        self._cookie_buffer_time: dict[int, float] = {}

    # ------------------------------------------------------------- dispatch

    async def handle_update(self, update: dict) -> None:
        if "callback_query" in update:
            await self._handle_callback(update["callback_query"])
            return

        message = update.get("message") or {}
        text = (message.get("text") or "").strip()
        document = message.get("document")
        chat = message.get("chat") or {}
        user = message.get("from") or {}
        chat_id = chat.get("id")
        user_id = user.get("id")
        if chat_id is None:
            return
        if not self.config.allowed(user_id):
            log.warning("ignoring message from unlisted user_id=%s", user_id)
            return

        log.info("Received message from user_id=%s, chat_id=%s: %r", user_id, chat_id, text[:100])

        # 1. Did the user send a document (file upload)?
        if document:
            caption = (message.get("caption") or "").strip()
            await self._handle_document_upload(chat_id, user_id, document, caption)
            return

        if not text:
            return

        # 2. Slash commands always win over pending state.
        if text.startswith("/"):
            await self._dispatch_command(chat_id, user_id, text)
            return

        # 3. Pending action consumes this message.
        pending = self._take_pending(user_id)
        if pending:
            if pending == "image":
                await self._locked(chat_id, self._run_image(chat_id, text))
                return
            elif pending == "ask":
                await self._locked(chat_id, self._run_ask(chat_id, text))
                return
            elif pending == "add_account":
                await self._locked(chat_id, self._create_account_from_prompt(chat_id, text))
                return
            elif pending.startswith("login_account:"):
                acc_id = pending[len("login_account:"):].strip()
                # Maintain pending state so subsequent chunks or retries stay in login mode
                self._set_pending(user_id, f"login_account:{acc_id}")
                await self._handle_cookie_submission(chat_id, user_id, text, account_id_hint=acc_id)
                return

        # 4. Check if raw cookie text / JSON / token was pasted directly
        if looks_like_cookie_or_token(text):
            await self._handle_cookie_submission(chat_id, user_id, text)
            return

        # 5. Auto-detect mode and image intent
        user_mode = self._user_modes.get(user_id, "chat") if user_id else "chat"
        if user_mode == "image" or is_image_intent(text):
            await self._locked(chat_id, self._run_image(chat_id, text))
        else:
            await self._locked(chat_id, self._run_ask(chat_id, text))

    async def _dispatch_command(self, chat_id: int, user_id: int | None, text: str) -> None:
        cmd = text.split()[0].split("@")[0].lower()
        if cmd == "/image":
            prompt = text[len("/image"):].strip()
            if prompt:
                await self._locked(chat_id, self._run_image(chat_id, prompt))
            else:
                await self._prime(chat_id, user_id, "image")
        elif cmd == "/ask":
            prompt = text[len("/ask"):].strip()
            if prompt:
                await self._locked(chat_id, self._run_ask(chat_id, prompt))
            else:
                await self._prime(chat_id, user_id, "ask")
        elif cmd == "/accounts":
            await self._locked(chat_id, self._cmd_accounts(chat_id, user_id, text))
        elif cmd == "/mode":
            await self._locked(chat_id, self._cmd_mode(chat_id, user_id, text))
        elif cmd == "/retry":
            await self._locked(chat_id, self._cmd_retry(chat_id, user_id))
        elif cmd == "/status":
            await self._locked(chat_id, self._show_status(chat_id))
        elif cmd == "/retries":
            await self._locked(chat_id, self._cmd_retries(chat_id, text))
        elif cmd == "/chats":
            await self._locked(chat_id, self._show_chats(chat_id))
        elif cmd == "/clear":
            await self._locked(chat_id, self._show_clear_confirm(chat_id))
        elif cmd == "/http":
            await self._locked(chat_id, self._cmd_http(chat_id, text))
        elif cmd == "/new":
            await self._locked(chat_id, self._cmd_new(chat_id))
        elif cmd in ("/start", "/menu", "/help"):
            await self._show_menu(chat_id, user_id=user_id)
        else:
            # Unknown command → check image intent or ask prompt.
            if is_image_intent(text):
                await self._locked(chat_id, self._run_image(chat_id, text))
            else:
                await self._locked(chat_id, self._run_ask(chat_id, text))

    async def _handle_callback(self, cb: dict) -> None:
        cb_id = cb.get("id")
        data = cb.get("data") or ""
        message = cb.get("message") or {}
        chat_id = (message.get("chat") or {}).get("id")
        user = cb.get("from") or {}
        user_id = user.get("id")
        if cb_id is None or chat_id is None:
            return
        if not self.config.allowed(user_id):
            log.warning("ignoring callback from unlisted user_id=%s", user_id)
            return

        log.info("Received callback from user_id=%s, chat_id=%s: data=%r", user_id, chat_id, data)

        # Acknowledge immediately to dismiss the spinner.
        await self.tg.answer_callback_query(cb_id)

        if data == "menu:home":
            await self._show_menu(chat_id, user_id=user_id, edit=message.get("message_id"))
        elif data == "menu:retries":
            await self._show_retries(chat_id, edit=message.get("message_id"))
        elif data.startswith("set:retries:"):
            n_str = data.split(":")[2]
            try:
                n = int(n_str)
                self.gpt.max_retries = n
                await self.tg.answer_callback_query(cb_id, f"Max retries set to {n}x")
                await self._show_retries(chat_id, edit=message.get("message_id"))
            except Exception as exc:
                await self.tg.answer_callback_query(cb_id, f"Error: {exc}", show_alert=True)
        elif data == "mode:image":
            if user_id:
                self._user_modes[user_id] = "image"
            await self.tg.answer_callback_query(cb_id, "Switched to Image Mode")
            await self._show_menu(chat_id, user_id=user_id, edit=message.get("message_id"))
        elif data == "mode:chat":
            if user_id:
                self._user_modes[user_id] = "chat"
            await self.tg.answer_callback_query(cb_id, "Switched to Chat Mode")
            await self._show_menu(chat_id, user_id=user_id, edit=message.get("message_id"))
        elif data == "retry:image":
            prompt = self._last_image_prompt.get(chat_id) or self._last_prompt.get(chat_id)
            if prompt:
                await self._locked(chat_id, self._run_image(chat_id, prompt))
            else:
                await self.tg.send_message(
                    chat_id, "No recent prompt found to retry.", reply_markup=_home_keyboard()
                )
        elif data == "retry:softened":
            prompt = self._last_image_prompt.get(chat_id) or self._last_prompt.get(chat_id)
            if prompt:
                tweaked = auto_tweak_prompt(prompt, level=1)
                await self._locked(
                    chat_id, self._run_image(chat_id, prompt, tweaked_prompt=tweaked)
                )
            else:
                await self.tg.send_message(
                    chat_id, "No recent prompt found to retry.", reply_markup=_home_keyboard()
                )
        elif data == "ask:to_image":
            prompt = self._last_prompt.get(chat_id)
            if prompt:
                await self._locked(chat_id, self._run_image(chat_id, prompt))
            else:
                await self.tg.send_message(
                    chat_id, "No recent prompt found.", reply_markup=_home_keyboard()
                )
        elif data == "menu:ask":
            await self._prime(chat_id, user_id, "ask", edit=message.get("message_id"))
        elif data == "menu:image":
            await self._prime(chat_id, user_id, "image", edit=message.get("message_id"))
        elif data == "menu:accounts":
            await self._locked(chat_id, self._show_accounts(chat_id, edit=message.get("message_id")))
        elif data.startswith("acc:switch:"):
            acc_id = data[len("acc:switch:"):].strip()
            await self._locked(chat_id, self._switch_account_callback(chat_id, cb_id, acc_id, edit=message.get("message_id")))
        elif data.startswith("acc:login:"):
            acc_id = data[len("acc:login:"):].strip()
            await self._start_login_prompt(chat_id, user_id, acc_id)
        elif data.startswith("acc:del:"):
            acc_id = data[len("acc:del:"):].strip()
            mgr = getattr(self.gpt, "account_manager", None)
            if mgr:
                try:
                    mgr.remove_account(acc_id)
                    await self.tg.answer_callback_query(cb_id, "Account removed")
                    await self._show_accounts(chat_id, edit=message.get("message_id"))
                except Exception as exc:
                    await self.tg.answer_callback_query(cb_id, f"Error: {exc}", show_alert=True)
        elif data.startswith("acc:apply_cookies:"):
            acc_id = data[len("acc:apply_cookies:"):].strip()
            cookie_text = self._pending_cookies.pop(user_id, "") if user_id else ""
            if cookie_text:
                await self._handle_cookie_submission(chat_id, user_id, cookie_text, account_id_hint=acc_id)
            else:
                await self.tg.answer_callback_query(cb_id, "No pending cookies found", show_alert=True)
        elif data == "acc:add":
            await self._prime(chat_id, user_id, "add_account", edit=message.get("message_id"))
        elif data == "menu:status":
            await self._locked(chat_id, self._show_status(chat_id, edit=message.get("message_id")))
        elif data == "menu:chats":
            await self._locked(chat_id, self._show_chats(chat_id, edit=message.get("message_id")))
        elif data == "menu:clear":
            await self._locked(chat_id, self._show_clear_confirm(chat_id, edit=message.get("message_id")))
        elif data == "menu:new":
            await self._locked(chat_id, self._cmd_new(chat_id, edit=message.get("message_id")))
        elif data == "clear:confirm":
            await self._locked(chat_id, self._do_clear(chat_id, edit=message.get("message_id")))
        elif data == "cb:cancel":
            self._clear_pending(user_id)
            await self.tg.answer_callback_query(cb_id, "Cancelled")
            await self._show_menu(chat_id, user_id=user_id, edit=message.get("message_id"))
        else:
            # Unknown callback — ignore (future-proofing).
            pass

    # ------------------------------------------------------------- pending

    def _take_pending(self, user_id: int | None) -> str | None:
        if user_id is None:
            return None
        entry = self._pending.get(user_id)
        if entry is None:
            return None
        action, ts = entry
        if time.monotonic() - ts > PENDING_TTL:
            del self._pending[user_id]
            return None
        del self._pending[user_id]
        return action

    def _set_pending(self, user_id: int | None, action: str) -> None:
        if user_id is not None:
            self._pending[user_id] = (action, time.monotonic())

    def _clear_pending(self, user_id: int | None) -> None:
        if user_id is not None:
            self._pending.pop(user_id, None)

    async def _prime(
        self,
        chat_id: int,
        user_id: int | None,
        action: str,
        edit: int | None = None,
    ) -> None:
        if user_id is not None:
            self._pending[user_id] = (action, time.monotonic())
        if action == "image":
            text = (
                "<b>Image</b>\n\n"
                "Describe the image you want. Generation can take 1–5 minutes."
            )
        elif action == "add_account":
            text = (
                "<b>Add Account</b>\n\n"
                "Send the alias name for the new account (e.g. <code>Backup</code> or <code>Personal</code>)."
            )
        else:
            text = "<b>Ask</b>\n\nSend your question as the next message."
        if edit is not None:
            await self.tg.edit_message_text(
                chat_id, edit, text, reply_markup=_cancel_keyboard()
            )
        else:
            await self.tg.send_message(chat_id, text, reply_markup=_cancel_keyboard())

    # ------------------------------------------------------------- renders

    async def _show_menu(
        self, chat_id: int, user_id: int | None = None, edit: int | None = None
    ) -> None:
        mode = self._user_modes.get(user_id, "chat") if user_id else "chat"
        retries = getattr(self.gpt, "max_retries", 10)
        kb = _menu_keyboard(mode, max_retries=retries)
        if edit is not None:
            await self.tg.edit_message_text(
                chat_id, edit, MENU_TEXT, reply_markup=kb
            )
        else:
            await self.tg.send_message(chat_id, MENU_TEXT, reply_markup=kb)

    async def _cmd_mode(self, chat_id: int, user_id: int | None, text: str) -> None:
        """Toggle between Chat Mode and Image Mode."""
        arg = text[len("/mode"):].strip().lower()
        current = self._user_modes.get(user_id, "chat") if user_id else "chat"
        if arg in ("image", "img", "photo", "art"):
            new_mode = "image"
        elif arg in ("chat", "text", "ask"):
            new_mode = "chat"
        else:
            new_mode = "image" if current == "chat" else "chat"
        if user_id:
            self._user_modes[user_id] = new_mode
        retries = getattr(self.gpt, "max_retries", 10)
        if new_mode == "image":
            msg = (
                "🎨 <b>Image Mode enabled.</b>\n\n"
                f"All prompts sent now will be generated as images with automatic {retries}x denial retries.\n"
                "Use <code>/mode chat</code> or the menu to switch back."
            )
        else:
            msg = (
                "💬 <b>Chat Mode enabled.</b>\n\n"
                "Text prompts will be answered as standard ChatGPT conversations.\n"
                "Image prompts (e.g. <i>'photo of...'</i>, <i>'draw...'</i>) are still automatically detected."
            )
        await self.tg.send_message(chat_id, msg, reply_markup=_home_keyboard())

    async def _cmd_retry(self, chat_id: int, user_id: int | None) -> None:
        """Retry the last image generation with denial retries."""
        prompt = self._last_image_prompt.get(chat_id) or self._last_prompt.get(chat_id)
        if not prompt:
            await self.tg.send_message(
                chat_id, "No recent prompt found to retry.", reply_markup=_home_keyboard()
            )
            return
        retries = getattr(self.gpt, "max_retries", 10)
        await self.tg.send_message(
            chat_id,
            f"🔄 <b>Retrying image generation ({retries}x denial retries)...</b>\n\n<i>{esc(prompt[:200])}</i>",
        )
        await self._run_image(chat_id, prompt)

    async def _cmd_retries(self, chat_id: int, text: str) -> None:
        """View or update max generation retry count."""
        parts = text.split()
        if len(parts) >= 2 and parts[1].isdigit():
            val = max(1, min(30, int(parts[1])))
            self.gpt.max_retries = val
            await self.tg.send_message(
                chat_id,
                f"✅ <b>Max generation retries updated to: {val}x</b>\n\n"
                f"• Direct prompt retries: 1–5\n"
                f"• Prompt rephrase retries: 6–{val}\n\n"
                "<i>Denial errors and transient failures will now retry up to this limit.</i>",
                reply_markup=_home_keyboard(),
            )
        else:
            await self._show_retries(chat_id)

    async def _show_retries(self, chat_id: int, edit: int | None = None) -> None:
        current = getattr(self.gpt, "max_retries", 10)
        text = (
            f"🔁 <b>Image Generation Retry Settings</b>\n\n"
            f"Current Max Retries: <b>{current}x</b>\n\n"
            "When ChatGPT refuses, times out, or fails to generate an image:\n"
            "• <b>Tries 1–5:</b> Direct automatic retries.\n"
            "• <b>Tries 6+:</b> Intelligent prompt rephrasing (preserves 1:1 visual intent).\n\n"
            "Select a retry limit below or type <code>/retries &lt;number&gt;</code> (e.g. <code>/retries 10</code>):"
        )
        kb = {
            "inline_keyboard": [
                [
                    _btn(f"{'🔘' if current == 3 else '⚪'} 3x", "set:retries:3"),
                    _btn(f"{'🔘' if current == 5 else '⚪'} 5x", "set:retries:5"),
                    _btn(f"{'🔘' if current == 10 else '⚪'} 10x", "set:retries:10"),
                    _btn(f"{'🔘' if current == 15 else '⚪'} 15x", "set:retries:15"),
                ],
                [_btn("📊 Status", "menu:status"), _btn("🏠 Menu", "menu:home")],
            ]
        }
        if edit is not None:
            await self.tg.edit_message_text(chat_id, edit, text, reply_markup=kb)
        else:
            await self.tg.send_message(chat_id, text, reply_markup=kb)

    async def _show_status(self, chat_id: int, edit: int | None = None) -> None:
        mgr = getattr(self.gpt, "account_manager", None)
        active_acc = mgr.get_active_account() if mgr else None

        alive = False
        try:
            alive = await self.gpt.session.is_alive()
        except Exception:
            pass
        if not alive and active_acc and active_acc.is_logged_in:
            alive = True
        pool = self.gpt.pool

        session_line = "logged in" if alive else "<b>not logged in</b>"
        http_line = "on" if getattr(self.gpt, "use_http", True) else "off"
        current = getattr(self.gpt, "_current_conversation_id", None)
        current_line = f"<code>{esc(current)}</code>" if current else "none (fresh chat)"
        retries = getattr(self.gpt, "max_retries", 10)

        lines = [
            "<b>Status</b>",
            "",
        ]
        if active_acc:
            lines.append(f"Account: <b>{esc(active_acc.alias)}</b> (<code>{esc(active_acc.id)}</code>)")
            if active_acc.email:
                lines.append(f"Identity: <code>{esc(active_acc.email)}</code>")
            if active_acc.is_rate_limited():
                rem_m = int(active_acc.remaining_rate_limit_seconds() / 60)
                lines.append(f"Rate Limit: ⚠️ <b>Limited</b> (~{rem_m}m left, resets {active_acc.rate_limit_resets_at_str}) [Strikes: {active_acc.consecutive_rate_limits}/3]")
            else:
                lines.append("Rate Limit: 🟢 Normal")
            lines.append("")

        lines.extend([
            f"Session: {session_line}",
            f"Browser: {'running' if self.gpt._started else 'not started'}",
            f"Chats tracked: {len(pool._ids)}",
            f"Fast HTTP path: {http_line}",
            f"Current chat: {current_line}",
            f"Max Retries: <b>{retries}x</b>",
        ])
        if not alive:
            lines.append("")
            lines.append("<i>Log in from the host machine, then check again.</i>")
        text = "\n".join(lines)
        kb = {
            "inline_keyboard": [
                [_btn(f"⚙️ Retries ({retries}x)", "menu:retries"), _btn("👤 Accounts", "menu:accounts")],
                [_btn("🔄 Refresh", "menu:status"), _btn("🏠 Menu", "menu:home")],
            ]
        }
        if edit is not None:
            await self.tg.edit_message_text(chat_id, edit, text, reply_markup=kb)
        else:
            await self.tg.send_message(chat_id, text, reply_markup=kb)

    async def _show_accounts(self, chat_id: int, edit: int | None = None) -> None:
        mgr = getattr(self.gpt, "account_manager", None)
        if not mgr:
            text = "<b>Accounts:</b> Multi-account manager is not enabled."
            kb = _home_keyboard()
        else:
            accounts = mgr.list_accounts()
            active = mgr.get_active_account()
            lines = [
                f"<b>👤 ChatGPT Accounts</b> ({len(accounts)} configured)",
                "",
            ]
            account_rows = []
            for acc in accounts:
                is_act = acc.id == active.id
                if not acc.is_logged_in:
                    badge = "⚠️ Not Logged In"
                elif is_act:
                    badge = "🟢 Active"
                elif acc.is_rate_limited():
                    badge = "⏳ Rate-limited"
                else:
                    badge = "⚪ Ready"
                email_info = f" (<code>{esc(acc.email)}</code>)" if acc.email else " <i>(Needs login)</i>"
                lines.append(f"• <b>{esc(acc.alias)}</b>{email_info} — {badge}")
                lines.append(f"  ID: <code>{esc(acc.id)}</code> | Generations: {acc.total_generations}")
                if acc.is_rate_limited():
                    rem_m = int(acc.remaining_rate_limit_seconds() / 60)
                    lines.append(f"  <i>Limit resets ~{acc.rate_limit_resets_at_str} (~{rem_m}m left)</i>")
                elif not acc.is_logged_in:
                    lines.append("  <i>⚠️ Needs login — tap 'Login' button below to provide cookies</i>")

                row = []
                if acc.is_logged_in:
                    btn_label = f"✓ {acc.alias}" if is_act else f"Switch: {acc.alias}"
                    row.append(_btn(btn_label, f"acc:switch:{acc.id}"))
                    row.append(_btn(f"🔑 Relogin {acc.alias}", f"acc:login:{acc.id}"))
                else:
                    row.append(_btn(f"🔑 Login: {acc.alias}", f"acc:login:{acc.id}"))
                if len(accounts) > 1 and not is_act:
                    row.append(_btn("🗑", f"acc:del:{acc.id}"))
                account_rows.append(row)

            lines.append("")
            lines.append("<i>To add an account: tap '➕ Add Account' or run /accounts add &lt;alias&gt;</i>")
            text = "\n".join(lines)

            account_rows.append([_btn("➕ Add Account", "acc:add"), _btn("🔄 Refresh", "menu:accounts")])
            account_rows.append([_btn("🏠 Menu", "menu:home")])
            kb = {"inline_keyboard": account_rows}

        if edit is not None:
            await self.tg.edit_message_text(chat_id, edit, text, reply_markup=kb)
        else:
            await self.tg.send_message(chat_id, text, reply_markup=kb)

    async def _cmd_accounts(self, chat_id: int, user_id: int | None, text: str) -> None:
        mgr = getattr(self.gpt, "account_manager", None)
        if not mgr:
            await self.tg.send_message(chat_id, "Multi-account manager is not enabled.", reply_markup=_home_keyboard())
            return

        parts = text.split()
        if len(parts) == 1:
            await self._show_accounts(chat_id)
            return

        subcmd = parts[1].lower()
        if subcmd == "switch" and len(parts) >= 3:
            target = parts[2]
            try:
                acc = await self.gpt.switch_account(target)
                status_text = "🟢 (Logged In)" if acc.is_logged_in else "⚠️ (Not Logged In — send cookies to authenticate)"
                await self.tg.send_message(
                    chat_id,
                    f"🟢 <b>Switched active account to:</b> <b>{esc(acc.alias)}</b> (<code>{esc(acc.id)}</code>) {status_text}",
                    reply_markup=_accounts_keyboard_quick(),
                )
            except Exception as exc:
                await self.tg.send_message(chat_id, f"❌ Failed to switch: {esc(str(exc))}")
        elif subcmd == "add" and len(parts) >= 3:
            alias = " ".join(parts[2:]).strip()
            try:
                acc = mgr.add_account(alias)
                target_uid = user_id if user_id is not None else chat_id
                self._set_pending(target_uid, f"login_account:{acc.id}")
                await self.tg.send_message(
                    chat_id,
                    f"✅ <b>Created Account slot:</b> <b>{esc(acc.alias)}</b> (<code>{esc(acc.id)}</code>)\n\n"
                    "👉 <b>Now send your ChatGPT cookies to log in:</b>\n"
                    "• 📄 <b>Upload file:</b> Send your <code>cookies.json</code> or <code>cookies.txt</code>\n"
                    "• 📋 <b>Or paste:</b> Paste your exported cookie JSON or Netscape text here\n\n"
                    "<i>(Export cookies from chatgpt.com in Chrome/Firefox using Cookie-Editor)</i>",
                    reply_markup=_accounts_keyboard_quick(),
                )
            except Exception as exc:
                await self.tg.send_message(chat_id, f"❌ Failed to add account: {esc(str(exc))}")
        elif subcmd == "login" and len(parts) >= 3:
            target = parts[2]
            await self._start_login_prompt(chat_id, user_id, target)
        elif subcmd == "remove" and len(parts) >= 3:
            target = parts[2]
            try:
                removed = mgr.remove_account(target)
                if removed:
                    await self.tg.send_message(
                        chat_id,
                        f"🗑 Removed account <code>{esc(target)}</code>.",
                        reply_markup=_accounts_keyboard_quick(),
                    )
                else:
                    await self.tg.send_message(chat_id, f"Account <code>{esc(target)}</code> not found.")
            except Exception as exc:
                await self.tg.send_message(chat_id, f"❌ Cannot remove account: {esc(str(exc))}")
        else:
            await self._show_accounts(chat_id)

    async def _switch_account_callback(
        self, chat_id: int, cb_id: str, acc_id: str, edit: int | None = None
    ) -> None:
        try:
            acc = await self.gpt.switch_account(acc_id)
            status_note = f" ({acc.email})" if acc.email else " (Needs login)"
            await self.tg.answer_callback_query(cb_id, f"Switched to {acc.alias}{status_note}")
            await self._show_accounts(chat_id, edit=edit)
        except Exception as exc:
            log.exception("failed to switch account via callback")
            await self.tg.answer_callback_query(cb_id, f"Error: {exc}", show_alert=True)

    async def _create_account_from_prompt(self, chat_id: int, alias: str) -> None:
        mgr = getattr(self.gpt, "account_manager", None)
        if not mgr:
            await self.tg.send_message(chat_id, "Account manager is not enabled.", reply_markup=_home_keyboard())
            return
        try:
            acc = mgr.add_account(alias.strip())
            user_id = chat_id
            self._set_pending(user_id, f"login_account:{acc.id}")
            await self.tg.send_message(
                chat_id,
                f"✅ <b>Account '{esc(acc.alias)}' created!</b>\n\n"
                "👉 <b>Now send your ChatGPT cookies to log in:</b>\n"
                "• 📄 <b>Upload file:</b> Send your <code>cookies.json</code> or <code>cookies.txt</code>\n"
                "• 📋 <b>Or paste:</b> Paste your exported cookie JSON or Netscape text here\n\n"
                "<i>(Export cookies from chatgpt.com in Chrome/Firefox using Cookie-Editor)</i>",
                reply_markup=_accounts_keyboard_quick(),
            )
        except Exception as exc:
            await self.tg.send_message(
                chat_id,
                f"❌ Failed to create account: {esc(str(exc))}",
                reply_markup=_accounts_keyboard_quick(),
            )

    async def _start_login_prompt(
        self, chat_id: int, user_id: int | None, acc_id_or_alias: str
    ) -> None:
        mgr = getattr(self.gpt, "account_manager", None)
        if not mgr:
            return
        acc = mgr.find_account(acc_id_or_alias)
        if not acc:
            await self.tg.send_message(
                chat_id, f"Account '{esc(acc_id_or_alias)}' not found.", reply_markup=_home_keyboard()
            )
            return
        target_uid = user_id if user_id is not None else chat_id
        self._set_pending(target_uid, f"login_account:{acc.id}")
        await self.tg.send_message(
            chat_id,
            f"🔑 <b>Log in ChatGPT Account: {esc(acc.alias)}</b>\n\n"
            "Please send your ChatGPT session cookies for this account:\n"
            "• 📄 <b>Upload file:</b> Send your <code>cookies.json</code> or <code>cookies.txt</code>\n"
            "• 📋 <b>Or paste:</b> Paste your exported cookie JSON or Netscape text directly here\n\n"
            "<i>(Tip: Log into chatgpt.com in Chrome/Firefox, open Cookie-Editor, and click Export)</i>",
            reply_markup=_accounts_keyboard_quick(),
        )

    async def _handle_document_upload(
        self, chat_id: int, user_id: int | None, document: dict, caption: str
    ) -> None:
        file_id = document.get("file_id")
        file_name = document.get("file_name", "").lower()
        if not file_id:
            return

        try:
            file_meta = await self.tg.get_file(file_id)
            file_path = file_meta.get("file_path") or (file_meta.get("result") or {}).get("file_path")
            if not file_path:
                raise RuntimeError("Telegram API returned empty file_path")
            raw_bytes = await self.tg.download_file(file_path)
            content_text = raw_bytes.decode("utf-8", errors="replace")
        except Exception as exc:
            log.warning("failed to download document: %s", exc)
            await self.tg.send_message(
                chat_id,
                f"❌ Failed to download file: <code>{esc(str(exc))}</code>",
                reply_markup=_home_keyboard(),
            )
            return

        pending = self._take_pending(user_id) if user_id else None
        target_acc_id = None
        if pending and pending.startswith("login_account:"):
            target_acc_id = pending[len("login_account:"):].strip()

        if is_cookie_content(content_text) or file_name.endswith((".json", ".txt")):
            await self._handle_cookie_submission(
                chat_id, user_id, content_text, account_id_hint=target_acc_id
            )
        else:
            await self.tg.send_message(
                chat_id,
                "📄 Received file, but it does not appear to contain ChatGPT cookies or tokens.\n"
                "<i>Please upload your cookies.json or cookies.txt file.</i>",
                reply_markup=_home_keyboard(),
            )

    async def _handle_cookie_submission(
        self,
        chat_id: int,
        user_id: int | None,
        cookie_text: str,
        account_id_hint: str | None = None,
    ) -> None:
        mgr = getattr(self.gpt, "account_manager", None)
        if not mgr:
            await self.tg.send_message(
                chat_id, "Account manager is not enabled.", reply_markup=_home_keyboard()
            )
            return

        target_acc = None
        if account_id_hint:
            target_acc = mgr.find_account(account_id_hint)

        if not target_acc:
            unauth = [a for a in mgr.list_accounts() if not a.is_logged_in]
            if len(unauth) == 1:
                target_acc = unauth[0]
            elif not unauth:
                target_acc = mgr.get_active_account()
            else:
                if user_id:
                    self._pending_cookies[user_id] = cookie_text
                rows = [
                    [_btn(f"🔑 Log in to: {a.alias}", f"acc:apply_cookies:{a.id}")]
                    for a in unauth
                ]
                rows.append([_btn("➕ New Account", "acc:add"), _btn("🏠 Menu", "menu:home")])
                await self.tg.send_message(
                    chat_id,
                    "🍪 <b>ChatGPT Cookies Received!</b>\n\n"
                    "Select which account you want to authenticate with these cookies:",
                    reply_markup={"inline_keyboard": rows},
                )
                return

        # Multi-chunk buffering for Telegram message splits
        raw_to_parse = cookie_text
        if user_id:
            buffered = self._cookie_buffer.get(user_id, "")
            if buffered:
                candidate_direct = buffered + cookie_text
                candidate_nl = buffered + "\n" + cookie_text
                chosen = None
                for cand in (candidate_direct, candidate_nl):
                    try:
                        c_list = parse_cookie_text(cand)
                        if cookies_valid(c_list):
                            chosen = cand
                            break
                    except Exception:
                        pass

                if chosen:
                    raw_to_parse = chosen
                    self._cookie_buffer.pop(user_id, None)
                    self._cookie_buffer_time.pop(user_id, None)
                else:
                    self._cookie_buffer[user_id] = candidate_direct
                    ts = asyncio.get_running_loop().time()
                    self._cookie_buffer_time[user_id] = ts
                    await asyncio.sleep(1.2)
                    if self._cookie_buffer_time.get(user_id) != ts:
                        return
                    final_buf = self._cookie_buffer.pop(user_id, candidate_direct)
                    self._cookie_buffer_time.pop(user_id, None)
                    for cand in (final_buf, final_buf.replace("\n", "")):
                        try:
                            c_list = parse_cookie_text(cand)
                            if cookies_valid(c_list):
                                raw_to_parse = cand
                                break
                        except Exception:
                            pass
                    else:
                        raw_to_parse = final_buf
            else:
                try:
                    c_list = parse_cookie_text(cookie_text)
                    if not cookies_valid(c_list):
                        self._cookie_buffer[user_id] = cookie_text
                        ts = asyncio.get_running_loop().time()
                        self._cookie_buffer_time[user_id] = ts
                        await asyncio.sleep(1.2)
                        if self._cookie_buffer_time.get(user_id) != ts:
                            return
                        raw_to_parse = self._cookie_buffer.pop(user_id, cookie_text)
                        self._cookie_buffer_time.pop(user_id, None)
                except Exception:
                    self._cookie_buffer[user_id] = cookie_text
                    ts = asyncio.get_running_loop().time()
                    self._cookie_buffer_time[user_id] = ts
                    await asyncio.sleep(1.2)
                    if self._cookie_buffer_time.get(user_id) != ts:
                        return
                    raw_to_parse = self._cookie_buffer.pop(user_id, cookie_text)
                    self._cookie_buffer_time.pop(user_id, None)

        await self.tg.send_chat_action(chat_id, "typing")
        try:
            async with self._lock:
                res = await self.gpt.login_account(target_acc.id, raw_to_parse)
            email = res.get("email") or target_acc.email
            name = res.get("name") or target_acc.name or target_acc.alias
            self._clear_pending(user_id)
            if user_id:
                self._cookie_buffer.pop(user_id, None)
                self._cookie_buffer_time.pop(user_id, None)
            await self.tg.send_message(
                chat_id,
                "🎉 <b>ChatGPT Login Successful!</b>\n\n"
                f"• <b>Account:</b> <b>{esc(target_acc.alias)}</b>\n"
                f"• <b>User:</b> <b>{esc(name)}</b>\n"
                f"• <b>Email:</b> <code>{esc(email)}</code>\n"
                "• <b>Status:</b> 🟢 Ready & Logged In\n\n"
                "<i>This ChatGPT account is now authenticated and ready.</i>",
                reply_markup=_accounts_keyboard_quick(),
            )
        except Exception as exc:
            log.exception("login_account failed")
            if user_id:
                self._cookie_buffer.pop(user_id, None)
                self._cookie_buffer_time.pop(user_id, None)
                self._set_pending(user_id, f"login_account:{target_acc.id}")
            await self.tg.send_message(
                chat_id,
                "❌ <b>ChatGPT Login Failed</b>\n\n"
                f"<code>{esc(str(exc))}</code>\n\n"
                "<i>💡 Tip: Ensure you are actively logged in on chatgpt.com before exporting. If you were logged out or on the login page, the session token is revoked.</i>",
                reply_markup={
                    "inline_keyboard": [
                        [_btn(f"🔑 Try Again: {target_acc.alias}", f"acc:login:{target_acc.id}")],
                        [_btn("👤 Accounts", "menu:accounts"), _btn("🏠 Menu", "menu:home")],
                    ]
                },
            )

    async def _cmd_http(self, chat_id: int, text: str) -> None:
        """Toggle the fast HTTP path on/off (``/http on``, ``/http off``, ``/http``)."""
        arg = text[len("/http"):].strip().lower()
        current = getattr(self.gpt, "use_http", True)
        if arg in ("on", "1", "true", "yes"):
            self.gpt.use_http = True
        elif arg in ("off", "0", "false", "no"):
            self.gpt.use_http = False
        else:
            # No argument → toggle.
            self.gpt.use_http = not current
        state = "on" if self.gpt.use_http else "off"
        await self.tg.send_message(
            chat_id,
            f"<b>Fast HTTP path: {state}</b>\n\n"
            "<i>When off, text answers always go through the browser "
            "(slower but reliable).</i>",
        )

    async def _cmd_new(self, chat_id: int, edit: int | None = None) -> None:
        """Start a fresh chat: reset the current conversation."""
        self.gpt.new_chat()
        text = (
            "<b>New chat started.</b>\n\n"
            "The next prompt will begin a fresh conversation."
        )
        if edit is not None:
            await self.tg.edit_message_text(chat_id, edit, text, reply_markup=_home_keyboard())
        else:
            await self.tg.send_message(chat_id, text, reply_markup=_home_keyboard())

    async def _show_chats(self, chat_id: int, edit: int | None = None) -> None:
        pool = self.gpt.pool
        if not pool._ids:
            text = "<b>Chats</b>\n\nNo tracked chats."
            kb = _home_keyboard()
        else:
            lines = [f"<b>Chats</b> ({len(pool._ids)}, oldest → newest)", ""]
            for i, cid in enumerate(pool._ids, 1):
                lines.append(f"{i}. <code>{esc(cid)}</code>")
            text = "\n".join(lines)
            kb = {
                "inline_keyboard": [
                    [_btn("🗑 Clear all", "menu:clear"), _btn("🏠 Menu", "menu:home")]
                ]
            }
        if edit is not None:
            await self.tg.edit_message_text(chat_id, edit, text, reply_markup=kb)
        else:
            await self.tg.send_message(chat_id, text, reply_markup=kb)

    async def _show_clear_confirm(self, chat_id: int, edit: int | None = None) -> None:
        n = len(self.gpt.pool._ids)
        text = (
            "<b>Clear all chats?</b>\n\n"
            f"This deletes all {n} tracked conversations. It can't be undone."
        )
        if edit is not None:
            await self.tg.edit_message_text(
                chat_id, edit, text, reply_markup=_clear_confirm_keyboard()
            )
        else:
            await self.tg.send_message(chat_id, text, reply_markup=_clear_confirm_keyboard())

    async def _heartbeat(
        self, chat_id: int, action: str, stop_event: asyncio.Event
    ) -> None:
        """Send chat action periodically every 4s until stop_event is set."""
        while not stop_event.is_set():
            try:
                await asyncio.wait_for(stop_event.wait(), timeout=4.0)
            except asyncio.TimeoutError:
                pass
            if stop_event.is_set():
                break
            try:
                await self.tg.send_chat_action(chat_id, action)
            except Exception as exc:
                log.debug("heartbeat %s failed: %s", action, exc)

    async def _run_ask(self, chat_id: int, prompt: str) -> None:
        if looks_like_cookie_or_token(prompt):
            log.warning("blocked cookie/auth data from being sent to ChatGPT ask API")
            await self.tg.send_message(
                chat_id,
                "⚠️ <b>Authentication Data Detected</b>\n\n"
                "This message looks like ChatGPT cookie or session data rather than a chat question, so it was <b>not</b> sent to ChatGPT.\n\n"
                "👉 To log in with these cookies, send them after tapping <b>[🔑 Login]</b> in <code>/accounts</code>, or upload your <code>cookies.json</code> file.",
                reply_markup=_accounts_keyboard_quick(),
            )
            return

        self._last_prompt[chat_id] = prompt
        await self.tg.send_chat_action(chat_id, "typing")
        stop_event = asyncio.Event()
        hb_task = asyncio.create_task(self._heartbeat(chat_id, "typing", stop_event))
        try:
            result = await self.gpt.ask(prompt)
        finally:
            stop_event.set()
            hb_task.cancel()
            try:
                await hb_task
            except asyncio.CancelledError:
                pass
        text = result.get("text") or "(empty answer)"
        formatted = markdown_to_telegram_html(text)
        if result.get("switched_from") and result.get("account_used"):
            formatted = f"<i>🔄 Auto-switched: {esc(result['switched_from'])} ➔ {esc(result['account_used'])}</i>\n\n" + formatted
        await self.tg.send_message(chat_id, formatted, reply_markup=_ask_footer())

    async def _run_image(
        self, chat_id: int, prompt: str, tweaked_prompt: str | None = None
    ) -> None:
        self._last_image_prompt[chat_id] = prompt
        self._last_prompt[chat_id] = prompt
        await self.tg.send_chat_action(chat_id, "upload_photo")
        stop_event = asyncio.Event()
        hb_task = asyncio.create_task(self._heartbeat(chat_id, "upload_photo", stop_event))
        try:
            kwargs: dict = {}
            if tweaked_prompt:
                kwargs["tweaked_prompt"] = tweaked_prompt
            result = await self.gpt.generate_image(prompt, **kwargs)
        finally:
            stop_event.set()
            hb_task.cancel()
            try:
                await hb_task
            except asyncio.CancelledError:
                pass
        retries = getattr(self.gpt, "max_retries", 10)
        caption = esc(prompt[:900])
        if result.get("switched_from") and result.get("account_used"):
            caption += f"\n\n🔄 <i>Auto-switched: {esc(result['switched_from'])} ➔ {esc(result['account_used'])}</i>"
        try:
            await self.tg.send_photo(
                chat_id,
                result["path"],
                caption=f"<i>{caption}</i>",
                reply_markup=_image_footer(retries),
            )
        except TypeError:
            await self.tg.send_photo(
                chat_id,
                result["path"],
                caption=f"<i>{caption}</i>",
            )
            await self.tg.send_message(chat_id, "Done.", reply_markup=_image_footer(retries))

    async def _do_clear(self, chat_id: int, edit: int | None = None) -> None:
        pool = self.gpt.pool
        ids = list(pool._ids)
        deleted = failed = 0
        for cid in ids:
            try:
                await self.gpt.session.delete_conversation(cid)
                deleted += 1
            except Exception:
                failed += 1
        pool._ids.clear()
        pool._save()
        text = f"<b>Done.</b> Cleared {deleted} conversations."
        if failed:
            text += f" ({failed} failed)"
        if edit is not None:
            await self.tg.edit_message_text(chat_id, edit, text, reply_markup=_home_keyboard())
        else:
            await self.tg.send_message(chat_id, text, reply_markup=_home_keyboard())

    # ------------------------------------------------------------- plumbing

    async def _locked(self, chat_id: int, coro) -> None:
        async with self._lock:
            try:
                await coro
            except GenerationDeniedError as exc:
                kind = getattr(exc, "kind", "unknown")
                if kind == "rate_limit":
                    strikes = getattr(exc, "strikes", 1)
                    alt_acc = getattr(exc, "alt_account", None)
                    info = getattr(exc, "rate_limit_info", {})
                    resets_str = info.get("resets_at_str") or "soon"
                    hours = info.get("hours", 3.0)

                    if strikes >= 3 and alt_acc:
                        try:
                            await self.gpt.switch_account(alt_acc.id)
                            switched = True
                        except Exception as switch_err:
                            log.warning("failed auto-switch: %s", switch_err)
                            switched = False

                        if switched:
                            text = (
                                f"⚠️ <b>Consecutive Rate Limits Detected (3/3 strikes).</b>\n\n"
                                f"Account was rate-limited until {resets_str} (~{hours}h).\n\n"
                                f"🔄 <b>Automatically switched to least-used account:</b>\n"
                                f"👉 <b>{esc(alt_acc.alias)}</b> ({esc(alt_acc.email or 'New Profile')})\n\n"
                                f"<i>Ready to retry your prompt on this account.</i>"
                            )
                            kb = {
                                "inline_keyboard": [
                                    [_btn("🔄 Retry on New Account", "retry:image"), _btn("🆕 New chat", "menu:new")],
                                    [_btn("👤 Accounts", "menu:accounts")],
                                ]
                            }
                        else:
                            text = (
                                f"⚠️ <b>Rate Limit Reached (3/3 strikes).</b>\n\n"
                                f"Account was rate-limited until {resets_str} (~{hours}h).\n"
                                f"Auto-switch to <b>{esc(alt_acc.alias)}</b> failed."
                            )
                            kb = {
                                "inline_keyboard": [
                                    [_btn("👤 Accounts", "menu:accounts"), _btn("🏠 Menu", "menu:home")]
                                ]
                            }
                        await self.tg.send_message(chat_id, text, reply_markup=kb)
                        return

                    elif strikes >= 3 and not alt_acc:
                        text = (
                            f"⚠️ <b>Rate Limit Reached (3/3 strikes).</b>\n\n"
                            f"Account is rate-limited until {resets_str} (~{hours}h).\n"
                            f"No alternative account is currently available.\n\n"
                            f"<i>Add another account using /accounts add &lt;alias&gt;</i>"
                        )
                        kb = {
                            "inline_keyboard": [
                                [_btn("➕ Add Account", "acc:add"), _btn("👤 Accounts", "menu:accounts")],
                                [_btn("🏠 Menu", "menu:home")],
                            ]
                        }
                        await self.tg.send_message(chat_id, text, reply_markup=kb)
                        return

                    else:
                        suggestion = (
                            f"\n💡 <i>Least-used alternative available: <b>{esc(alt_acc.alias)}</b></i>\n"
                            if alt_acc
                            else ""
                        )
                        text = (
                            f"⚠️ <b>ChatGPT Rate Limit (Strike {strikes}/3)</b>\n\n"
                            f"Expected to reset around {resets_str} (~{hours}h).{suggestion}"
                        )
                        rows = []
                        if alt_acc:
                            rows.append([_btn(f"🔀 Switch to {alt_acc.alias}", f"acc:switch:{alt_acc.id}")])
                        rows.append([_btn("🔄 Retry Anyway", "retry:image"), _btn("🆕 New chat", "menu:new")])
                        rows.append([_btn("🏠 Menu", "menu:home")])
                        await self.tg.send_message(chat_id, text, reply_markup={"inline_keyboard": rows})
                        return

                # Normal policy denial
                text = (
                    "<b>Image denied.</b>\n\n"
                    "ChatGPT refused this prompt for policy reasons.\n"
                    "<i>Tap Auto-Tweak to soften wording and retry, or try a new prompt:</i>"
                )
                kb = {
                    "inline_keyboard": [
                        [_btn("⚡ Auto-Tweak & Retry (10x)", "retry:softened"), _btn("🎨 Try again", "menu:image")],
                        [_btn("🆕 New chat", "menu:new"), _btn("🏠 Menu", "menu:home")],
                    ]
                }
                await self.tg.send_message(chat_id, text, reply_markup=kb)
            except BridgeTimeoutError:
                text = (
                    "<b>Timed out.</b>\n\n"
                    "ChatGPT didn't respond in time.\n"
                    "<i>It may still be generating — try again in a minute.</i>"
                )
                kb = {
                    "inline_keyboard": [
                        [_btn("🎨 Try again", "menu:image"), _btn("🏠 Menu", "menu:home")]
                    ]
                }
                await self.tg.send_message(chat_id, text, reply_markup=kb)
            except AuthError:
                text = (
                    "<b>Not logged in.</b>\n\n"
                    "The ChatGPT session has expired.\n"
                    "<i>Log in again from the host machine, then check /status.</i>"
                )
                kb = {
                    "inline_keyboard": [
                        [_btn("📊 Status", "menu:status"), _btn("🏠 Menu", "menu:home")]
                    ]
                }
                await self.tg.send_message(chat_id, text, reply_markup=kb)
            except Exception as exc:  # last-resort
                log.exception("command failed")
                text = (
                    "<b>Something went wrong.</b>\n\n"
                    f"<code>{esc(type(exc).__name__)}</code>\n"
                    "<i>Try again, or check the bridge logs.</i>"
                )
                await self.tg.send_message(chat_id, text, reply_markup=_home_keyboard())


# --------------------------------------------------------------------------- #
# Poll loop / entry
# --------------------------------------------------------------------------- #

async def run(config: BotConfig, gpt: ChatGPT | None = None) -> None:
    tg = TelegramAPI(config.token)
    if gpt is None:
        use_http = (os.environ.get("CHATGPT_BRIDGE_USE_HTTP") or "1").strip().lower()
        gpt = ChatGPT(headless=False, use_http=use_http not in ("0", "false", "no", "off"))
    bot = BridgeBot(tg, config, gpt)
    offset = 0
    log.info("bot polling started")
    try:
        await tg.set_my_commands(COMMANDS)
        while True:
            try:
                updates = await tg.get_updates(offset)
            except (httpx.HTTPError, RuntimeError) as exc:
                log.warning("poll error: %s — retrying in 5s", exc)
                await asyncio.sleep(5)
                continue
            for update in updates:
                offset = max(offset, update["update_id"] + 1)
                asyncio.create_task(bot.handle_update(update))
    finally:
        await tg.close()


def main() -> None:
    logging.basicConfig(
        level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s"
    )
    config = BotConfig.from_env()
    if config.allow_all:
        log.info("TELEGRAM_ALLOWED_USER_IDS is '*' — bot will accept messages from all users")
    elif not config.allowed_user_ids:
        log.warning("TELEGRAM_ALLOWED_USER_IDS is empty — bot will ignore everyone")
    else:
        log.info("Allowed user IDs: %s", sorted(config.allowed_user_ids))
    asyncio.run(run(config))


if __name__ == "__main__":
    main()
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
import logging
import os
import time
from pathlib import Path
from typing import Mapping

import httpx

from .core import ChatGPT
from .errors import AuthError, BridgeTimeoutError, GenerationDeniedError

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
    def __init__(self, token: str, allowed_user_ids: frozenset[int]) -> None:
        self.token = token
        self.allowed_user_ids = allowed_user_ids

    @classmethod
    def from_env(cls, env: Mapping[str, str] | None = None) -> "BotConfig":
        env = os.environ if env is None else env
        token = (env.get("TELEGRAM_BOT_TOKEN") or "").strip()
        if not token:
            raise SystemExit(
                "TELEGRAM_BOT_TOKEN is required — create a bot via @BotFather."
            )
        raw = (env.get("TELEGRAM_ALLOWED_USER_IDS") or "").strip()
        ids = frozenset(int(x) for x in raw.split(",") if x.strip())
        return cls(token=token, allowed_user_ids=ids)

    def allowed(self, user_id: int | None) -> bool:
        if not self.allowed_user_ids or user_id is None:
            return False
        return user_id in self.allowed_user_ids


# --------------------------------------------------------------------------- #
# Thin Bot API client
# --------------------------------------------------------------------------- #

def esc(text: str) -> str:
    """Escape a string for Telegram HTML parse mode (only & < > need it)."""
    return html.escape(text, quote=False)


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
            last = await self._call("sendMessage", **payload)
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
            if "not modified" not in str(exc):
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
        self, chat_id: int, path: str | Path, caption: str = "", parse_mode: str = "HTML"
    ) -> None:
        with open(path, "rb") as fh:
            resp = await self._client.post(
                "/sendPhoto",
                data={
                    "chat_id": str(chat_id),
                    "caption": caption,
                    "parse_mode": parse_mode,
                },
                files={"photo": (Path(path).name, fh, "image/png")},
            )
        data = resp.json()
        if not data.get("ok"):
            raise RuntimeError(f"telegram sendPhoto failed: {data.get('description')}")

    async def close(self) -> None:
        await self._client.aclose()


def _chunk(text: str) -> list[str]:
    """Split text into <=MAX_MSG chunks on paragraph boundaries.

    A single paragraph longer than MAX_MSG is hard-split at the limit.
    """
    if len(text) <= MAX_MSG:
        return [text]
    chunks: list[str] = []
    current = ""
    for para in text.split("\n"):
        # Hard-split an overlong paragraph.
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


# --------------------------------------------------------------------------- #
# Inline keyboards
# --------------------------------------------------------------------------- #

def _btn(label: str, data: str) -> dict:
    return {"text": label, "callback_data": data}


def _menu_keyboard() -> dict:
    return {
        "inline_keyboard": [
            [_btn("❓ Ask", "menu:ask"), _btn("🎨 Image", "menu:image")],
            [_btn("📊 Status", "menu:status"), _btn("💬 Chats", "menu:chats")],
            [_btn("🗑 Clear all chats", "menu:clear")],
        ]
    }


def _home_keyboard() -> dict:
    return {"inline_keyboard": [[_btn("🏠 Menu", "menu:home")]]}


def _ask_footer() -> dict:
    return {
        "inline_keyboard": [
            [_btn("🔁 Ask again", "menu:ask"), _btn("🏠 Menu", "menu:home")]
        ]
    }


def _image_footer() -> dict:
    return {
        "inline_keyboard": [
            [_btn("🎨 Another image", "menu:image"), _btn("🏠 Menu", "menu:home")]
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


# --------------------------------------------------------------------------- #
# Handlers
# --------------------------------------------------------------------------- #

MENU_TEXT = (
    "Hi — I'm your ChatGPT bridge.\n\n"
    "Ask a question, generate an image, or manage your chats below."
)

COMMANDS = [
    {"command": "ask", "description": "Ask ChatGPT a question"},
    {"command": "image", "description": "Generate an image"},
    {"command": "status", "description": "Show session and bridge health"},
    {"command": "chats", "description": "List tracked conversations"},
    {"command": "clear", "description": "Delete all tracked conversations"},
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
        # pending action per user: {user_id: ("ask"|"image", timestamp)}
        self._pending: dict[int, tuple[str, float]] = {}

    # ------------------------------------------------------------- dispatch

    async def handle_update(self, update: dict) -> None:
        if "callback_query" in update:
            await self._handle_callback(update["callback_query"])
            return

        message = update.get("message") or {}
        text = (message.get("text") or "").strip()
        chat = message.get("chat") or {}
        user = message.get("from") or {}
        chat_id = chat.get("id")
        user_id = user.get("id")
        if chat_id is None or not text:
            return
        if not self.config.allowed(user_id):
            await self.tg.send_message(chat_id, "This bot is private.")
            return

        # Slash commands always win over pending state.
        if text.startswith("/"):
            await self._dispatch_command(chat_id, user_id, text)
            return

        # Pending action (tap-to-prime) consumes this message as the prompt.
        pending = self._take_pending(user_id)
        if pending == "image":
            await self._locked(chat_id, self._run_image(chat_id, text))
        else:
            # Default: plain text is an Ask prompt.
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
        elif cmd == "/status":
            await self._locked(chat_id, self._show_status(chat_id))
        elif cmd == "/chats":
            await self._locked(chat_id, self._show_chats(chat_id))
        elif cmd == "/clear":
            await self._locked(chat_id, self._show_clear_confirm(chat_id))
        elif cmd in ("/start", "/menu", "/help"):
            await self._show_menu(chat_id)
        else:
            # Unknown command → treat as ask prompt.
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
            await self.tg.answer_callback_query(cb_id, "This bot is private.")
            return

        # Acknowledge immediately to dismiss the spinner.
        await self.tg.answer_callback_query(cb_id)

        if data == "menu:home":
            await self._show_menu(chat_id, edit=message.get("message_id"))
        elif data == "menu:ask":
            await self._prime(chat_id, user_id, "ask", edit=message.get("message_id"))
        elif data == "menu:image":
            await self._prime(chat_id, user_id, "image", edit=message.get("message_id"))
        elif data == "menu:status":
            await self._locked(chat_id, self._show_status(chat_id, edit=message.get("message_id")))
        elif data == "menu:chats":
            await self._locked(chat_id, self._show_chats(chat_id, edit=message.get("message_id")))
        elif data == "menu:clear":
            await self._locked(chat_id, self._show_clear_confirm(chat_id, edit=message.get("message_id")))
        elif data == "clear:confirm":
            await self._locked(chat_id, self._do_clear(chat_id, edit=message.get("message_id")))
        elif data == "cb:cancel":
            self._clear_pending(user_id)
            await self.tg.answer_callback_query(cb_id, "Cancelled")
            await self._show_menu(chat_id, edit=message.get("message_id"))
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
        else:
            text = "<b>Ask</b>\n\nSend your question as the next message."
        if edit is not None:
            await self.tg.edit_message_text(
                chat_id, edit, text, reply_markup=_cancel_keyboard()
            )
        else:
            await self.tg.send_message(chat_id, text, reply_markup=_cancel_keyboard())

    # ------------------------------------------------------------- renders

    async def _show_menu(self, chat_id: int, edit: int | None = None) -> None:
        if edit is not None:
            await self.tg.edit_message_text(
                chat_id, edit, MENU_TEXT, reply_markup=_menu_keyboard()
            )
        else:
            await self.tg.send_message(chat_id, MENU_TEXT, reply_markup=_menu_keyboard())

    async def _show_status(self, chat_id: int, edit: int | None = None) -> None:
        alive = await self.gpt.session.is_alive()
        pool = self.gpt.pool
        session_line = "logged in" if alive else "<b>not logged in</b>"
        lines = [
            "<b>Status</b>",
            "",
            f"Session: {session_line}",
            f"Browser: {'running' if self.gpt._started else 'not started'}",
            f"Chats tracked: {len(pool._ids)}",
        ]
        if not alive:
            lines.append("")
            lines.append("<i>Log in from the host machine, then check again.</i>")
        text = "\n".join(lines)
        kb = {
            "inline_keyboard": [
                [_btn("🔄 Refresh", "menu:status"), _btn("🏠 Menu", "menu:home")]
            ]
        }
        if edit is not None:
            await self.tg.edit_message_text(chat_id, edit, text, reply_markup=kb)
        else:
            await self.tg.send_message(chat_id, text, reply_markup=kb)

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

    # ------------------------------------------------------------- actions

    async def _run_ask(self, chat_id: int, prompt: str) -> None:
        await self.tg.send_chat_action(chat_id, "typing")
        result = await self.gpt.ask(prompt)
        text = result.get("text") or "(empty answer)"
        await self.tg.send_message(chat_id, esc(text), reply_markup=_ask_footer())

    async def _run_image(self, chat_id: int, prompt: str) -> None:
        await self.tg.send_chat_action(chat_id, "upload_photo")
        result = await self.gpt.generate_image(prompt)
        caption = esc(prompt[:1000])
        await self.tg.send_photo(chat_id, result["path"], caption=f"<i>{caption}</i>")
        await self.tg.send_message(chat_id, "Done.", reply_markup=_image_footer())

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
                text = (
                    "<b>Image denied.</b>\n\n"
                    "ChatGPT refused this prompt for policy reasons.\n"
                    "<i>Try rephrasing, or ask for something simpler.</i>"
                )
                kb = {
                    "inline_keyboard": [
                        [_btn("🎨 Try again", "menu:image"), _btn("🏠 Menu", "menu:home")]
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
    bot = BridgeBot(tg, config, gpt or ChatGPT(headless=False))
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
    if not config.allowed_user_ids:
        log.warning("TELEGRAM_ALLOWED_USER_IDS is empty — bot will ignore everyone")
    asyncio.run(run(config))


if __name__ == "__main__":
    main()
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

Commands: plain text → ask; /image <prompt>; /status; /chats; /clear;
/start, /help.
"""

from __future__ import annotations

import asyncio
import logging
import os
from pathlib import Path
from typing import Mapping

import httpx

from .core import ChatGPT
from .errors import AuthError, BridgeTimeoutError, GenerationDeniedError

API = "https://api.telegram.org"

# Hard Telegram message limit; split longer answers into sequential messages.
MAX_MSG = 4096

HELP = (
    "chatgpt-bridge bot\n"
    "\n"
    "Send any text to chat. Commands:\n"
    "/image <prompt> — generate an image\n"
    "/status — session/browser/pool status\n"
    "/chats — list tracked chats in the pool\n"
    "/clear — delete all tracked chats\n"
    "/help — this message"
)

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
        ids = frozenset(
            int(x) for x in raw.split(",") if x.strip()
        )
        return cls(token=token, allowed_user_ids=ids)

    def allowed(self, user_id: int | None) -> bool:
        if not self.allowed_user_ids or user_id is None:
            return False
        return user_id in self.allowed_user_ids


# --------------------------------------------------------------------------- #
# Thin Bot API client
# --------------------------------------------------------------------------- #

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
            allowed_updates=["message"],
        )
        return list(result)

    async def send_message(self, chat_id: int, text: str) -> None:
        for i in range(0, len(text), MAX_MSG):
            await self._call(
                "sendMessage", chat_id=chat_id, text=text[i : i + MAX_MSG]
            )

    async def send_chat_action(self, chat_id: int, action: str = "typing") -> None:
        await self._call("sendChatAction", chat_id=chat_id, action=action)

    async def send_photo(self, chat_id: int, path: str | Path, caption: str = "") -> None:
        with open(path, "rb") as fh:
            resp = await self._client.post(
                "/sendPhoto",
                data={"chat_id": str(chat_id), "caption": caption},
                files={"photo": (Path(path).name, fh, "image/png")},
            )
        data = resp.json()
        if not data.get("ok"):
            raise RuntimeError(f"telegram sendPhoto failed: {data.get('description')}")

    async def close(self) -> None:
        await self._client.aclose()


# --------------------------------------------------------------------------- #
# Handlers
# --------------------------------------------------------------------------- #

class BridgeBot:
    """Telegram → chatgpt-bridge command dispatcher."""

    def __init__(self, tg: TelegramAPI, config: BotConfig, gpt: ChatGPT) -> None:
        self.tg = tg
        self.config = config
        self.gpt = gpt
        self._lock = asyncio.Lock()

    async def handle_update(self, update: dict) -> None:
        message = update.get("message") or {}
        text = (message.get("text") or "").strip()
        chat = message.get("chat") or {}
        user = message.get("from") or {}
        chat_id = chat.get("id")
        if chat_id is None or not text:
            return
        if not self.config.allowed(user.get("id")):
            return  # silent ignore

        if text.startswith("/image"):
            await self._locked(chat_id, self._cmd_image(chat_id, text))
        elif text.startswith("/status"):
            await self._locked(chat_id, self._cmd_status(chat_id))
        elif text.startswith("/chats"):
            await self._locked(chat_id, self._cmd_chats(chat_id))
        elif text.startswith("/clear"):
            await self._locked(chat_id, self._cmd_clear(chat_id))
        elif text.startswith(("/start", "/help")):
            await self.tg.send_message(chat_id, HELP)
        else:
            await self._locked(chat_id, self._cmd_ask(chat_id, text))

    # ------------------------------------------------------------- commands

    async def _cmd_ask(self, chat_id: int, text: str) -> None:
        await self.tg.send_chat_action(chat_id, "typing")
        result = await self.gpt.ask(text)
        await self.tg.send_message(chat_id, result.get("text") or "(empty answer)")

    async def _cmd_image(self, chat_id: int, text: str) -> None:
        prompt = text[len("/image"):].strip()
        if not prompt:
            await self.tg.send_message(chat_id, "usage: /image <prompt>")
            return
        await self.tg.send_chat_action(chat_id, "upload_photo")
        result = await self.gpt.generate_image(prompt)
        await self.tg.send_photo(chat_id, result["path"], caption=prompt[:1024])

    async def _cmd_status(self, chat_id: int) -> None:
        alive = await self.gpt.session.is_alive()
        pool = self.gpt.pool
        lines = [
            f"session: {'alive' if alive else 'DEAD'}",
            f"browser: {'started' if self.gpt._started else 'not started'}",
            f"pool: {len(pool._ids)}/{pool.max_chats} chats tracked",
            f"pool file: {pool.state_path}",
        ]
        await self.tg.send_message(chat_id, "\n".join(lines))

    async def _cmd_chats(self, chat_id: int) -> None:
        pool = self.gpt.pool
        if not pool._ids:
            await self.tg.send_message(chat_id, "pool is empty")
            return
        lines = [f"{i + 1}. {cid}" for i, cid in enumerate(pool._ids)]
        await self.tg.send_message(
            chat_id, "tracked chats (oldest → newest):\n" + "\n".join(lines)
        )

    async def _cmd_clear(self, chat_id: int) -> None:
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
        await self.tg.send_message(
            chat_id, f"cleared pool: {deleted} deleted, {failed} failed"
        )

    # ------------------------------------------------------------- plumbing

    async def _locked(self, chat_id: int, coro) -> None:
        async with self._lock:
            try:
                await coro
            except GenerationDeniedError as exc:
                await self.tg.send_message(
                    chat_id,
                    f"generation denied ({getattr(exc, 'kind', 'unknown')}). "
                    "Try rewording the prompt.",
                )
            except BridgeTimeoutError:
                await self.tg.send_message(
                    chat_id, "timed out — try a shorter prompt or retry."
                )
            except AuthError:
                await self.tg.send_message(
                    chat_id,
                    "session expired — refresh ~/.chatgpt-bridge/cookies.txt",
                )
            except Exception as exc:  # last-resort
                log.exception("command failed")
                await self.tg.send_message(chat_id, f"error: {type(exc).__name__}")


# --------------------------------------------------------------------------- #
# Poll loop / entry
# --------------------------------------------------------------------------- #

async def run(config: BotConfig, gpt: ChatGPT | None = None) -> None:
    tg = TelegramAPI(config.token)
    bot = BridgeBot(tg, config, gpt or ChatGPT(headless=False))
    offset = 0
    log.info("bot polling started")
    try:
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

"""Unit tests for the Telegram bot: config, handlers, error mapping.

All offline — Bot API calls are mocked via _FakeTG; the bridge core is a fake.
"""

from __future__ import annotations

import asyncio

import pytest

from chatgpt_bridge.bot import BotConfig, BridgeBot, MAX_MSG, HELP
from chatgpt_bridge.errors import AuthError, BridgeTimeoutError, GenerationDeniedError


class _FakeTG:
    def __init__(self) -> None:
        self.sent: list[tuple] = []

    async def send_message(self, chat_id, text):
        self.sent.append(("msg", chat_id, text))

    async def send_chat_action(self, chat_id, action="typing"):
        self.sent.append(("action", chat_id, action))

    async def send_photo(self, chat_id, path, caption=""):
        self.sent.append(("photo", chat_id, path, caption))


class _FakePool:
    def __init__(self, ids=None):
        self._ids = list(ids or [])
        self.max_chats = 10
        self.state_path = "/tmp/pool.json"

    def _save(self):
        pass


class _FakeSession:
    def __init__(self, alive=True):
        self._alive = alive
        self.deleted: list[str] = []

    async def is_alive(self):
        return self._alive

    async def delete_conversation(self, cid):
        self.deleted.append(cid)


class _FakeGPT:
    def __init__(self, ask_result=None, raise_exc=None):
        self._started = False
        self.pool = _FakePool(["c1", "c2"])
        self.session = _FakeSession()
        self._ask_result = ask_result or {"text": "hi back", "conversation_id": "c3"}
        self._raise = raise_exc
        self.asks: list[str] = []

    async def ask(self, prompt):
        self.asks.append(prompt)
        if self._raise:
            raise self._raise
        return self._ask_result

    async def generate_image(self, prompt):
        if self._raise:
            raise self._raise
        return {"path": "/tmp/x.png", "prompt": prompt, "conversation_id": "c4"}


ALLOWED = 42


def _cfg(ids=(ALLOWED,)):
    return BotConfig(token="t", allowed_user_ids=frozenset(ids))


def _bot(gpt=None, cfg=None):
    tg = _FakeTG()
    return tg, BridgeBot(tg, cfg or _cfg(), gpt or _FakeGPT())


def _update(text, user_id=ALLOWED, chat_id=99):
    return {
        "message": {
            "from": {"id": user_id},
            "chat": {"id": chat_id},
            "text": text,
        }
    }


def _await(coro):
    return asyncio.run(coro)


# ---- config ----

def test_config_from_env_parses_ids():
    cfg = BotConfig.from_env(
        {"TELEGRAM_BOT_TOKEN": "x", "TELEGRAM_ALLOWED_USER_IDS": "111, 222,333"}
    )
    assert cfg.allowed_user_ids == frozenset({111, 222, 333})
    assert cfg.allowed(222)
    assert not cfg.allowed(444)


def test_config_missing_token_exits():
    with pytest.raises(SystemExit):
        BotConfig.from_env({"TELEGRAM_BOT_TOKEN": ""})


def test_config_empty_whitelist_denies_all():
    cfg = _cfg(ids=())
    assert not cfg.allowed(42)


# ---- access control ----

def test_unlisted_user_silently_ignored():
    tg, bot = _bot()
    _await(bot.handle_update(_update("hello", user_id=999)))
    assert tg.sent == []


def test_non_message_update_ignored():
    tg, bot = _bot()
    _await(bot.handle_update({"channel_post": {}}))
    assert tg.sent == []


# ---- commands ----

def test_plain_text_is_asked_and_replied():
    tg, bot = _bot()
    _await(bot.handle_update(_update("hello there")))
    assert ("action", 99, "typing") in tg.sent
    assert ("msg", 99, "hi back") in tg.sent


def test_image_sends_photo():
    tg, bot = _bot()
    _await(bot.handle_update(_update("/image a red circle")))
    assert ("photo", 99, "/tmp/x.png", "a red circle") in tg.sent


def test_image_without_prompt_returns_usage():
    tg, bot = _bot()
    _await(bot.handle_update(_update("/image")))
    assert ("msg", 99, "usage: /image <prompt>") in tg.sent


def test_status_reports_health():
    tg, bot = _bot()
    _await(bot.handle_update(_update("/status")))
    msg = [m for m in tg.sent if m[0] == "msg"][0][2]
    assert "session: alive" in msg
    assert "pool: 2/10 chats tracked" in msg


def test_chats_lists_pool():
    tg, bot = _bot()
    _await(bot.handle_update(_update("/chats")))
    msg = [m for m in tg.sent if m[0] == "msg"][0][2]
    assert "1. c1" in msg and "2. c2" in msg


def test_clear_deletes_all_and_resets_pool():
    gpt = _FakeGPT()
    tg, bot = _bot(gpt=gpt)
    _await(bot.handle_update(_update("/clear")))
    assert gpt.session.deleted == ["c1", "c2"]
    assert gpt.pool._ids == []
    msg = [m for m in tg.sent if m[0] == "msg"][0][2]
    assert "2 deleted, 0 failed" in msg


def test_help():
    tg, bot = _bot()
    _await(bot.handle_update(_update("/help")))
    assert ("msg", 99, HELP) in tg.sent


# ---- error mapping ----

def test_denial_error_maps_to_message():
    tg, bot = _bot(gpt=_FakeGPT(raise_exc=GenerationDeniedError("denied", "deterministic")))
    _await(bot.handle_update(_update("/image mickey mouse")))
    msg = [m for m in tg.sent if m[0] == "msg"][0][2]
    assert "deterministic" in msg


def test_timeout_error_maps_to_message():
    tg, bot = _bot(gpt=_FakeGPT(raise_exc=BridgeTimeoutError("slow")))
    _await(bot.handle_update(_update("hello")))
    msg = [m for m in tg.sent if m[0] == "msg"][0][2]
    assert "timed out" in msg


def test_auth_error_maps_to_cookie_hint():
    tg, bot = _bot(gpt=_FakeGPT(raise_exc=AuthError("no session")))
    _await(bot.handle_update(_update("hello")))
    msg = [m for m in tg.sent if m[0] == "msg"][0][2]
    assert "cookies.txt" in msg


def test_generic_error_reports_type_only():
    tg, bot = _bot(gpt=_FakeGPT(raise_exc=ValueError("secret internals")))
    _await(bot.handle_update(_update("hello")))
    msg = [m for m in tg.sent if m[0] == "msg"][0][2]
    assert msg == "error: ValueError"
    assert "secret internals" not in msg


# ---- long messages ----

def test_long_answer_split_into_chunks():
    big = "x" * (MAX_MSG + 500)
    tg, bot = _bot(gpt=_FakeGPT(ask_result={"text": big, "conversation_id": "c"}))
    _await(bot.handle_update(_update("hello")))
    msgs = [m[2] for m in tg.sent if m[0] == "msg"]
    assert len(msgs[0]) == MAX_MSG
    assert len(msgs[1]) == 500
    assert "".join(msgs) == big


def test_generation_denied_error_requires_kind_positional():
    # sanity: error carries kind as positional second arg
    exc = GenerationDeniedError("x", "denial")
    assert exc.kind == "denial"

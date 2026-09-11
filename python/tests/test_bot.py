"""Unit tests for the Telegram bot: config, handlers, error mapping, UX.

All offline — Bot API calls are mocked via _FakeTG; the bridge core is a fake.
"""

from __future__ import annotations

import asyncio

import pytest

from chatgpt_bridge.bot import BotConfig, BridgeBot, MAX_MSG, MENU_TEXT, _chunk
from chatgpt_bridge.errors import AuthError, BridgeTimeoutError, GenerationDeniedError


class _FakeTG:
    def __init__(self) -> None:
        self.sent: list[tuple] = []
        self.edited: list[tuple] = []
        self.answered: list[tuple] = []
        self.commands: list[dict] | None = None

    async def send_message(self, chat_id, text, parse_mode="HTML", reply_markup=None):
        # Mirror the real TelegramAPI.send_message chunking behavior.
        for i, chunk in enumerate(_chunk(text)):
            kb = reply_markup if i == len(_chunk(text)) - 1 else None
            self.sent.append(("msg", chat_id, chunk, kb))

    async def edit_message_text(self, chat_id, message_id, text, parse_mode="HTML", reply_markup=None):
        self.edited.append(("edit", chat_id, message_id, text, reply_markup))

    async def answer_callback_query(self, cb_id, text="", show_alert=False):
        self.answered.append((cb_id, text))

    async def set_my_commands(self, commands):
        self.commands = commands

    async def send_chat_action(self, chat_id, action="typing"):
        self.sent.append(("action", chat_id, action))

    async def send_photo(self, chat_id, path, caption="", parse_mode="HTML"):
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
        self.use_http = True
        self.pool = _FakePool(["c1", "c2"])
        self.session = _FakeSession()
        self._ask_result = ask_result or {"text": "hi back", "conversation_id": "c3"}
        self._raise = raise_exc
        self.asks: list[str] = []
        self._current_conversation_id = None
        self.new_chat_calls = 0

    async def ask(self, prompt):
        self.asks.append(prompt)
        if self._raise:
            raise self._raise
        return self._ask_result

    async def generate_image(self, prompt):
        if self._raise:
            raise self._raise
        return {"path": "/tmp/x.png", "prompt": prompt, "conversation_id": "c4"}

    def new_chat(self):
        self.new_chat_calls += 1
        self._current_conversation_id = None


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


def _callback(data, user_id=ALLOWED, chat_id=99, message_id=5):
    return {
        "callback_query": {
            "id": "cb-1",
            "data": data,
            "from": {"id": user_id},
            "message": {"chat": {"id": chat_id}, "message_id": message_id},
        }
    }


def _await(coro):
    return asyncio.run(coro)


def _msgs(tg):
    return [m for m in tg.sent if m[0] == "msg"]


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

def test_unlisted_user_gets_private_reply():
    tg, bot = _bot()
    _await(bot.handle_update(_update("hello", user_id=999)))
    assert tg.sent == [("msg", 99, "This bot is private.", None)]


def test_non_message_update_ignored():
    tg, bot = _bot()
    _await(bot.handle_update({"channel_post": {}}))
    assert tg.sent == []


# ---- plain text / ask ----

def test_plain_text_is_asked_and_replied():
    tg, bot = _bot()
    _await(bot.handle_update(_update("hello there")))
    assert ("action", 99, "typing") in tg.sent
    msgs = _msgs(tg)
    assert any(m[2] == "hi back" for m in msgs)


def test_ask_answer_has_footer_keyboard():
    tg, bot = _bot()
    _await(bot.handle_update(_update("hello")))
    msgs = _msgs(tg)
    kb = msgs[-1][3]
    assert kb is not None
    assert "menu:ask" in str(kb) and "menu:home" in str(kb)


# ---- image ----

def test_image_sends_photo():
    tg, bot = _bot()
    _await(bot.handle_update(_update("/image a red circle")))
    assert ("photo", 99, "/tmp/x.png", "<i>a red circle</i>") in tg.sent


def test_image_without_prompt_primes():
    tg, bot = _bot()
    _await(bot.handle_update(_update("/image")))
    msgs = _msgs(tg)
    assert any("Describe the image" in m[2] for m in msgs)
    # pending state set
    assert bot._pending.get(ALLOWED) is not None


def test_image_prime_then_prompt_generates():
    tg, bot = _bot()
    _await(bot.handle_update(_update("/image")))
    _await(bot.handle_update(_update("a blue square")))
    assert ("photo", 99, "/tmp/x.png", "<i>a blue square</i>") in tg.sent


# ---- status / chats / clear ----

def test_status_reports_health():
    tg, bot = _bot()
    _await(bot.handle_update(_update("/status")))
    msg = _msgs(tg)[0][2]
    assert "Session: logged in" in msg
    assert "Chats tracked: 2" in msg


def test_status_not_logged_in_shows_guidance():
    gpt = _FakeGPT()
    gpt.session = _FakeSession(alive=False)
    tg, bot = _bot(gpt=gpt)
    _await(bot.handle_update(_update("/status")))
    msg = _msgs(tg)[0][2]
    assert "not logged in" in msg


def test_chats_lists_pool():
    tg, bot = _bot()
    _await(bot.handle_update(_update("/chats")))
    msg = _msgs(tg)[0][2]
    assert "c1" in msg and "c2" in msg


def test_clear_requires_confirm_first():
    gpt = _FakeGPT()
    tg, bot = _bot(gpt=gpt)
    _await(bot.handle_update(_update("/clear")))
    # No deletion yet — just a confirm prompt.
    assert gpt.session.deleted == []
    msg = _msgs(tg)[0][2]
    assert "Clear all chats?" in msg


def test_clear_confirm_deletes_all():
    gpt = _FakeGPT()
    tg, bot = _bot(gpt=gpt)
    _await(bot.handle_update(_update("/clear")))
    _await(bot.handle_update(_callback("clear:confirm")))
    assert gpt.session.deleted == ["c1", "c2"]
    assert gpt.pool._ids == []


def test_clear_cancel_does_not_delete():
    gpt = _FakeGPT()
    tg, bot = _bot(gpt=gpt)
    _await(bot.handle_update(_update("/clear")))
    _await(bot.handle_update(_callback("cb:cancel")))
    assert gpt.session.deleted == []
    assert gpt.pool._ids == ["c1", "c2"]


# ---- menu / callbacks ----

def test_start_shows_menu():
    tg, bot = _bot()
    _await(bot.handle_update(_update("/start")))
    msgs = _msgs(tg)
    assert any(m[2] == MENU_TEXT for m in msgs)


def test_menu_callback_edits_in_place():
    tg, bot = _bot()
    _await(bot.handle_update(_callback("menu:home")))
    assert tg.answered == [("cb-1", "")]
    assert any(e[3] == MENU_TEXT for e in tg.edited)


def test_menu_ask_primes_pending():
    tg, bot = _bot()
    _await(bot.handle_update(_callback("menu:ask")))
    assert bot._pending.get(ALLOWED) is not None


def test_unlisted_callback_ignored():
    tg, bot = _bot()
    _await(bot.handle_update(_callback("menu:home", user_id=999)))
    assert tg.edited == []


# ---- error mapping ----

def test_denial_error_maps_to_message():
    tg, bot = _bot(gpt=_FakeGPT(raise_exc=GenerationDeniedError("denied", "deterministic")))
    _await(bot.handle_update(_update("/image mickey mouse")))
    msg = _msgs(tg)[0][2]
    assert "Image denied" in msg


def test_timeout_error_maps_to_message():
    tg, bot = _bot(gpt=_FakeGPT(raise_exc=BridgeTimeoutError("slow")))
    _await(bot.handle_update(_update("hello")))
    msg = _msgs(tg)[0][2]
    assert "Timed out" in msg


def test_auth_error_maps_to_cookie_hint():
    tg, bot = _bot(gpt=_FakeGPT(raise_exc=AuthError("no session")))
    _await(bot.handle_update(_update("hello")))
    msg = _msgs(tg)[0][2]
    assert "Not logged in" in msg


def test_generic_error_reports_type_only():
    tg, bot = _bot(gpt=_FakeGPT(raise_exc=ValueError("secret internals")))
    _await(bot.handle_update(_update("hello")))
    msg = _msgs(tg)[0][2]
    assert "Something went wrong" in msg
    assert "secret internals" not in msg


# ---- long messages ----

def test_long_answer_split_into_chunks():
    big = "x" * (MAX_MSG + 500)
    tg, bot = _bot(gpt=_FakeGPT(ask_result={"text": big, "conversation_id": "c"}))
    _await(bot.handle_update(_update("hello")))
    msgs = [m[2] for m in _msgs(tg)]
    assert len(msgs[0]) == MAX_MSG
    assert len(msgs[1]) == 500
    assert "".join(msgs) == big


def test_generation_denied_error_requires_kind_positional():
    exc = GenerationDeniedError("x", "denial")
    assert exc.kind == "denial"


# ---- http toggle ----

def test_http_toggle_off():
    gpt = _FakeGPT()
    tg, bot = _bot(gpt=gpt)
    _await(bot.handle_update(_update("/http off")))
    assert gpt.use_http is False
    msg = _msgs(tg)[0][2]
    assert "off" in msg


def test_http_toggle_on():
    gpt = _FakeGPT()
    gpt.use_http = False
    tg, bot = _bot(gpt=gpt)
    _await(bot.handle_update(_update("/http on")))
    assert gpt.use_http is True


def test_http_toggle_no_arg_flips():
    gpt = _FakeGPT()
    tg, bot = _bot(gpt=gpt)
    _await(bot.handle_update(_update("/http")))
    assert gpt.use_http is False


def test_status_shows_http_mode():
    gpt = _FakeGPT()
    gpt.use_http = False
    tg, bot = _bot(gpt=gpt)
    _await(bot.handle_update(_update("/status")))
    msg = _msgs(tg)[0][2]
    assert "Fast HTTP path: off" in msg


# ---- new chat / conversation continuity ----

def test_new_command_resets_conversation():
    gpt = _FakeGPT()
    gpt._current_conversation_id = "conv-abc"
    tg, bot = _bot(gpt=gpt)
    _await(bot.handle_update(_update("/new")))
    assert gpt.new_chat_calls == 1
    assert gpt._current_conversation_id is None
    msg = _msgs(tg)[0][2]
    assert "New chat" in msg


def test_new_callback_resets_conversation():
    gpt = _FakeGPT()
    gpt._current_conversation_id = "conv-abc"
    tg, bot = _bot(gpt=gpt)
    _await(bot.handle_update(_callback("menu:new")))
    assert gpt.new_chat_calls == 1
    assert gpt._current_conversation_id is None


def test_status_shows_current_chat():
    gpt = _FakeGPT()
    gpt._current_conversation_id = "conv-xyz"
    tg, bot = _bot(gpt=gpt)
    _await(bot.handle_update(_update("/status")))
    msg = _msgs(tg)[0][2]
    assert "conv-xyz" in msg


def test_status_shows_no_current_chat():
    gpt = _FakeGPT()
    tg, bot = _bot(gpt=gpt)
    _await(bot.handle_update(_update("/status")))
    msg = _msgs(tg)[0][2]
    assert "none (fresh chat)" in msg
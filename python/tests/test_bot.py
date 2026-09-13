"""Unit tests for the Telegram bot: config, handlers, error mapping, UX.

All offline — Bot API calls are mocked via _FakeTG; the bridge core is a fake.
"""

from __future__ import annotations

import asyncio

import pytest

from chatgpt_bridge.bot import (
    BotConfig,
    BridgeBot,
    MAX_MSG,
    MENU_TEXT,
    TelegramAPI,
    _chunk,
    markdown_to_telegram_html,
)
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

def test_unlisted_user_silently_ignored():
    tg, bot = _bot()
    _await(bot.handle_update(_update("hello", user_id=999)))
    assert tg.sent == []


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


# ---- markdown to html conversion & safety ----

def test_markdown_to_telegram_html_code_blocks():
    md = "```python\ndef foo():\n    return 42\n```\n```\nraw text\n```"
    html_out = markdown_to_telegram_html(md)
    assert '<pre><code class="language-python">def foo():\n    return 42</code></pre>' in html_out
    assert '<pre><code>raw text</code></pre>' in html_out


def test_markdown_to_telegram_html_formatting():
    md = (
        "# Heading 1\n"
        "This is **bold**, *italic*, ~~strikethrough~~, and `inline code`.\n"
        "> Quote line 1\n"
        "> Quote line 2\n"
        "- Item 1\n"
        "* Item 2\n"
        "[Link text](https://example.com)"
    )
    out = markdown_to_telegram_html(md)
    assert "<b>Heading 1</b>" in out
    assert "<b>bold</b>" in out
    assert "<i>italic</i>" in out
    assert "<s>strikethrough</s>" in out
    assert "<code>inline code</code>" in out
    assert "<blockquote>Quote line 1\nQuote line 2</blockquote>" in out
    assert "• Item 1" in out
    assert "• Item 2" in out
    assert '<a href="https://example.com">Link text</a>' in out


def test_markdown_to_telegram_html_entities():
    md = "if x < 10 and y > 20: foo & bar"
    out = markdown_to_telegram_html(md)
    assert "x &lt; 10 and y &gt; 20: foo &amp; bar" in out


def test_ask_formats_markdown_to_html():
    gpt = _FakeGPT(ask_result={"text": "**Bold reply** and `code`", "conversation_id": "c1"})
    tg, bot = _bot(gpt=gpt)
    _await(bot.handle_update(_update("hello")))
    msgs = _msgs(tg)
    assert any("<b>Bold reply</b> and <code>code</code>" in m[2] for m in msgs)


def test_chunk_preserves_html_tags_across_boundaries():
    code_lines = "line = 1\n" * 500
    html_text = f'<pre><code class="language-python">{code_lines}</code></pre>'
    chunks = _chunk(html_text)
    assert len(chunks) >= 2
    for ch in chunks:
        assert len(ch) <= MAX_MSG
        assert ch.count("<pre>") == ch.count("</pre>")
        assert ch.count("<code") == ch.count("</code>")


def test_heartbeat_action_runs_during_ask():
    tg, bot = _bot()
    _await(bot.handle_update(_update("test heartbeat")))
    actions = [a for a in tg.sent if a[0] == "action"]
    assert len(actions) >= 1
    assert actions[0][2] == "typing"


def test_heartbeat_periodic_loop():
    tg = _FakeTG()
    bot = BridgeBot(tg, _cfg(), _FakeGPT())
    stop_event = asyncio.Event()

    async def run_test():
        # Replace asyncio.wait_for with a fast timeout to test the periodic send loop
        orig_wait_for = asyncio.wait_for

        async def fast_wait_for(fut, timeout):
            return await orig_wait_for(fut, timeout=0.01)

        import chatgpt_bridge.bot as bmod
        old_wf = bmod.asyncio.wait_for
        bmod.asyncio.wait_for = fast_wait_for
        try:
            task = asyncio.create_task(bot._heartbeat(99, "typing", stop_event))
            await asyncio.sleep(0.03)
            stop_event.set()
            await task
        finally:
            bmod.asyncio.wait_for = old_wf

    asyncio.run(run_test())
    actions = [a for a in tg.sent if a[0] == "action"]
    assert len(actions) >= 1
    assert actions[0][2] == "typing"


def test_telegram_api_fallback_on_parse_error():
    import json
    import httpx

    calls = []

    def handler(request: httpx.Request):
        body = json.loads(request.content.decode("utf-8"))
        calls.append(body)
        if body.get("parse_mode") == "HTML":
            return httpx.Response(
                200,
                json={"ok": False, "description": "Bad Request: can't parse entities"},
            )
        return httpx.Response(
            200,
            json={"ok": True, "result": {"message_id": 1, "text": body["text"]}},
        )

    transport = httpx.MockTransport(handler)
    api = TelegramAPI("token", transport=transport)
    res = asyncio.run(api.send_message(123, "<b>unclosed tag"))
    assert res["message_id"] == 1
    assert len(calls) == 2
    assert calls[0]["parse_mode"] == "HTML"
    assert "parse_mode" not in calls[1]
    assert calls[1]["text"] == "unclosed tag"


def test_telegram_api_edit_fallback_on_parse_error():
    import json
    import httpx

    calls = []

    def handler(request: httpx.Request):
        body = json.loads(request.content.decode("utf-8"))
        calls.append(body)
        if body.get("parse_mode") == "HTML":
            return httpx.Response(
                200,
                json={"ok": False, "description": "Bad Request: can't parse entities"},
            )
        return httpx.Response(200, json={"ok": True, "result": {"message_id": 1}})

    transport = httpx.MockTransport(handler)
    api = TelegramAPI("token", transport=transport)
    asyncio.run(api.edit_message_text(123, 1, "<b>bad tag"))
    assert len(calls) == 2
    assert calls[0]["parse_mode"] == "HTML"
    assert "parse_mode" not in calls[1]


def test_telegram_api_send_photo_multipart(tmp_path):
    import httpx

    img_file = tmp_path / "test.png"
    img_file.write_bytes(b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR" + b"fake_png_bytes")

    received = {}

    def handler(request: httpx.Request):
        received["url"] = str(request.url)
        received["content_type"] = request.headers.get("content-type", "")
        body = request.content
        received["body_bytes"] = body
        return httpx.Response(
            200,
            json={
                "ok": True,
                "result": {"message_id": 99, "photo": [{"file_id": "photo_123"}]},
            },
        )

    transport = httpx.MockTransport(handler)
    api = TelegramAPI("token123", transport=transport)
    asyncio.run(
        api.send_photo(777, img_file, caption="<i>A sunset</i>", parse_mode="HTML")
    )

    assert "/sendPhoto" in received["url"]
    assert "multipart/form-data" in received["content_type"]
    assert b"test.png" in received["body_bytes"]
    assert b"777" in received["body_bytes"]
    assert b"<i>A sunset</i>" in received["body_bytes"]
    assert b"fake_png_bytes" in received["body_bytes"]


def test_telegram_api_send_photo_fallback_on_parse_error(tmp_path):
    import httpx

    img_file = tmp_path / "test2.png"
    img_file.write_bytes(b"\x89PNG\r\n\x1a\nfake_bytes")

    calls = []

    def handler(request: httpx.Request):
        calls.append(request.content)
        if len(calls) == 1:
            # First attempt with parse_mode fails with entity error
            return httpx.Response(
                200,
                json={
                    "ok": False,
                    "description": "Bad Request: can't parse entities in photo caption",
                },
            )
        # Second attempt succeeds
        return httpx.Response(
            200,
            json={"ok": True, "result": {"message_id": 100}},
        )

    transport = httpx.MockTransport(handler)
    api = TelegramAPI("token123", transport=transport)
    asyncio.run(
        api.send_photo(777, img_file, caption="<b>unclosed tag", parse_mode="HTML")
    )

    assert len(calls) == 2
    # Second attempt had parse_mode stripped and tags removed
    assert b"unclosed tag" in calls[1]
    assert b"parse_mode" not in calls[1]


def test_bot_image_command_full_flow(tmp_path):
    img_file = tmp_path / "bot_image.png"
    img_file.write_bytes(b"\x89PNG\r\n\x1a\nfake_image_data")

    class _ImageGPT(_FakeGPT):
        async def generate_image(self, prompt):
            return {"path": str(img_file), "prompt": prompt, "conversation_id": "c-img"}

    tg, bot = _bot(gpt=_ImageGPT())
    _await(bot.handle_update(_update("/image a glowing forest")))

    # 1. Action sent
    actions = [a for a in tg.sent if a[0] == "action"]
    assert len(actions) >= 1
    assert actions[0][2] == "upload_photo"

    # 2. Photo sent
    photos = [p for p in tg.sent if p[0] == "photo"]
    assert len(photos) == 1
    _, chat_id, path, caption = photos[0]
    assert chat_id == 99
    assert path == str(img_file)
    assert caption == "<i>a glowing forest</i>"

    # 3. Follow-up "Done." with footer keyboard sent
    msgs = [m for m in tg.sent if m[0] == "msg"]
    assert any(m[2] == "Done." and "menu:image" in str(m[3]) for m in msgs)


# ---- new ux: image intent, image mode, and retries ----

def test_is_image_intent_detection():
    from chatgpt_bridge.bot import is_image_intent

    # Intent prompts
    assert is_image_intent("draw a cute kitten")
    assert is_image_intent("generate an image of a mountain lake")
    assert is_image_intent("a realistic photo of an old bookstore")
    assert is_image_intent("Close-up portrait of the same woman, but in 3/4 angle")
    assert is_image_intent("Medium wide shot of her standing in a doorway")
    assert is_image_intent("Low-angle shot looking upward towards the ceiling")

    # Regular chat prompts
    assert not is_image_intent("Hello, how are you today?")
    assert not is_image_intent("Explain quantum entanglement in simple terms")
    assert not is_image_intent("Write a python script to parse json")
    assert not is_image_intent("draw conclusions from this research paper")


def test_plain_text_with_image_intent_routes_to_image():
    tg, bot = _bot()
    # Plain text without /image, but with clear image intent
    _await(bot.handle_update(_update("draw a cyberpunk sunset")))
    photos = [p for p in tg.sent if p[0] == "photo"]
    assert len(photos) == 1
    assert photos[0][3] == "<i>draw a cyberpunk sunset</i>"


def test_mode_command_and_toggling():
    tg, bot = _bot()
    # Toggle to image
    _await(bot.handle_update(_update("/mode image")))
    assert bot._user_modes.get(ALLOWED) == "image"
    msg = _msgs(tg)[-1][2]
    assert "Image Mode enabled" in msg

    # Plain text without any image keywords is routed to image generation when in Image Mode!
    _await(bot.handle_update(_update("a blue square")))
    photos = [p for p in tg.sent if p[0] == "photo"]
    assert len(photos) == 1
    assert photos[0][3] == "<i>a blue square</i>"

    # Switch back to chat mode
    _await(bot.handle_update(_update("/mode chat")))
    assert bot._user_modes.get(ALLOWED) == "chat"
    msg = _msgs(tg)[-1][2]
    assert "Chat Mode enabled" in msg


def test_mode_callbacks():
    tg, bot = _bot()
    _await(bot.handle_update(_callback("mode:image")))
    assert bot._user_modes.get(ALLOWED) == "image"

    _await(bot.handle_update(_callback("mode:chat")))
    assert bot._user_modes.get(ALLOWED) == "chat"


def test_retry_command_and_callback():
    class _TrackedGPT(_FakeGPT):
        def __init__(self):
            super().__init__()
            self.generated: list[str] = []

        async def generate_image(self, prompt, **kwargs):
            self.generated.append(prompt)
            return {"path": "/tmp/x.png", "prompt": prompt, "conversation_id": "c"}

    gpt = _TrackedGPT()
    tg, bot = _bot(gpt=gpt)

    # 1. Initial image
    _await(bot.handle_update(_update("/image red rose")))
    assert gpt.generated == ["red rose"]

    # 2. Callback retry:image
    _await(bot.handle_update(_callback("retry:image")))
    assert gpt.generated == ["red rose", "red rose"]

    # 3. Slash command /retry
    _await(bot.handle_update(_update("/retry")))
    assert gpt.generated == ["red rose", "red rose", "red rose"]


def test_ask_to_image_callback():
    class _TrackedGPT(_FakeGPT):
        def __init__(self):
            super().__init__()
            self.generated: list[str] = []

        async def generate_image(self, prompt, **kwargs):
            self.generated.append(prompt)
            return {"path": "/tmp/x.png", "prompt": prompt, "conversation_id": "c"}

    gpt = _TrackedGPT()
    tg, bot = _bot(gpt=gpt)

    # User asks a normal question in chat
    _await(bot.handle_update(_update("describe a fantasy castle in clouds")))
    assert gpt.asks == ["describe a fantasy castle in clouds"]

    # User taps "Generate as Image"
    _await(bot.handle_update(_callback("ask:to_image")))
    assert gpt.generated == ["describe a fantasy castle in clouds"]


def test_retry_softened_callback():
    class _TrackedGPT(_FakeGPT):
        def __init__(self):
            super().__init__()
            self.tweaked: list[str | None] = []

        async def generate_image(self, prompt, tweaked_prompt=None, **kwargs):
            self.tweaked.append(tweaked_prompt)
            return {"path": "/tmp/x.png", "prompt": prompt, "conversation_id": "c"}

    gpt = _TrackedGPT()
    tg, bot = _bot(gpt=gpt)

    # Initial image
    _await(bot.handle_update(_update("/image a warrior with sword in battle")))
    assert gpt.tweaked == [None]

    # Retry with auto-tweak softening
    _await(bot.handle_update(_callback("retry:softened")))
    assert len(gpt.tweaked) == 2
    assert gpt.tweaked[1] is not None
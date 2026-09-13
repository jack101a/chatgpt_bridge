"""Unit tests for the image retry loop using scripted fake pages."""

from __future__ import annotations

import asyncio

import pytest

from chatgpt_bridge.errors import GenerationDeniedError
from chatgpt_bridge.retry import RetryConfig
from chatgpt_bridge.ui_driver import UIDriver


class _FakeLocator:
    def __init__(
        self,
        count: int = 0,
        src: str | None = None,
        alt: str | None = None,
        text: str = "",
    ) -> None:
        self._count = count
        self._src = src
        self._alt = alt
        self._text = text
        self.clicked = False

    @property
    def first(self):
        return self

    @property
    def last(self):
        return self

    async def count(self) -> int:
        return self._count

    async def get_attribute(self, name: str) -> str | None:
        if name == "alt":
            return self._alt
        return self._src

    async def inner_text(self) -> str:
        return self._text

    async def is_visible(self) -> bool:
        return self._count > 0

    async def click(self) -> None:
        self.clicked = True

    def nth(self, i: int):
        return self

    def locator(self, selector: str):
        return self


class _FakeKeyboard:
    def __init__(self) -> None:
        self.pressed: list[str] = []

    async def press(self, key: str) -> None:
        self.pressed.append(key)


class _FakePage:
    """Static fake page: a single DOM state, held indefinitely."""

    def __init__(self, state: dict, reveal_image_on_submit: bool = False) -> None:
        self._state = dict(state)
        self._reveal_image_on_submit = reveal_image_on_submit
        self.keyboard = _FakeKeyboard()
        self.url = "https://chatgpt.com/c/conv-1"

    def reveal_image(self) -> None:
        self._state["image"] = True

    def locator(self, selector: str):
        cur = self._state
        if selector == "button":
            return _FakeLocator(
                count=1 if cur.get("try_again") else 0,
                text="Try again" if cur.get("try_again") else "",
            )
        if "Switch model" in selector:
            return _FakeLocator(count=1 if cur.get("switch_model") else 0)
        if (
            "image-gen-loading" in selector
            or "stop" in selector.lower()
            or "streaming" in selector
            or "aria-busy" in selector
            or "loading" in selector
            or "dalle" in selector
            or "tool" in selector
        ):
            return _FakeLocator(count=1 if cur.get("loading") else 0)
        if "conversation-turn" in selector:
            return _FakeLocator(count=1, text=cur.get("text", ""))
        # IMAGE_SELECTOR (alt/src based)
        if any(
            x in selector
            for x in ("img", "estuary", "oaiusercontent", "Generated image", "src")
        ):
            return _FakeLocator(
                count=1 if cur.get("image") else 0,
                src=cur.get("src"),
                alt=cur.get("alt"),
            )
        return _FakeLocator(count=0)

    async def close(self):
        pass


class _SequencePage(_FakePage):
    """Fake page that advances through a list of states on each locator() call.

    Models the real flow: loading state appears first, then the image.
    """

    def __init__(self, states: list[dict]) -> None:
        super().__init__(states[0])
        self._states = states
        self._idx = 0

    def locator(self, selector: str):
        # Advance to the next state on each poll cycle (each selector query).
        # We advance only on the loading selector so the sequence is stable
        # within a single poll iteration.
        if "image-gen-loading" in selector:
            self._idx = min(self._idx + 1, len(self._states) - 1)
        self._state = self._states[self._idx]
        return super().locator(selector)


def _driver(pages):
    """Build a UIDriver whose _page() returns successive pages from ``pages``.

    Once the list is exhausted, the last page is returned repeatedly.
    """
    d = UIDriver.__new__(UIDriver)
    d.browser = None
    d.session = None
    it = iter(pages)
    last = pages[-1]

    async def fake_page(conversation_id=None):
        return next(it, last)

    d._page = fake_page

    async def fake_submit(page, prompt):
        if getattr(page, "_reveal_image_on_submit", False):
            page.reveal_image()
        return None

    d._submit_prompt = fake_submit
    return d


def _outcome(state, timeout_s: float = 5.0) -> dict:
    d = UIDriver.__new__(UIDriver)
    d.browser = None
    d.session = None
    page = _FakePage(state)
    return asyncio.run(d._wait_for_outcome(page, timeout_s=timeout_s))


def test_outcome_image():
    # loading appears first, then the image (models real generation flow)
    page = _SequencePage(
        [
            {"loading": True},
            {"loading": True},
            {"image": True, "src": "https://x/estuary/content?id=file_abc123&sig=1", "alt": "Generated image: new"},
        ]
    )
    d = UIDriver.__new__(UIDriver)
    d.browser = None
    d.session = None
    out = asyncio.run(d._wait_for_outcome(page, timeout_s=5))
    assert out == {"kind": "image", "src": "https://x/estuary/content?id=file_abc123&sig=1"}


def test_outcome_try_again_clicked():
    # "Try again" is clicked in place (regenerate same message); the fake page
    # never produces an image, so polling continues until timeout.
    from chatgpt_bridge.errors import BridgeTimeoutError

    with pytest.raises(BridgeTimeoutError):
        _outcome({"try_again": True}, timeout_s=0.5)


def test_outcome_deterministic():
    out = _outcome({"text": "too similar to third-party content (copyright)"})
    assert out["kind"] == "deterministic"


def test_outcome_denial_switch_model_fallback():
    # denial text, no try-again button, but switch-model popover reveals one.
    # The fallback clicks the trigger + "Try again" in place, then keeps polling
    # (no image ever appears on the fake page → timeout).
    from chatgpt_bridge.errors import BridgeTimeoutError

    page = _FakePage(
        {"text": "I can't create that image due to content policy.", "switch_model": True}
    )
    d = UIDriver.__new__(UIDriver)
    d.browser = None
    d.session = None

    # First _click_try_again finds nothing; _switch_model_fallback clicks the
    # trigger then finds a try-again button. Simulate by making the button
    # appear only after the switch-model trigger is clicked.
    class _SwitchPage(_FakePage):
        def __init__(self):
            super().__init__(
                {"text": "I can't create that image due to content policy.", "switch_model": True}
            )
            self._trigger_clicked = False

        def locator(self, selector):
            if selector == "button":
                return _FakeLocator(
                    count=1 if self._trigger_clicked else 0,
                    text="Try again",
                )
            if "Switch model" in selector:
                loc = _FakeLocator(count=1)

                async def click():
                    self._trigger_clicked = True

                loc.click = click
                return loc
            if "conversation-turn" in selector:
                return _FakeLocator(count=1, text=self._state["text"])
            return _FakeLocator(count=0)

    page = _SwitchPage()
    with pytest.raises(BridgeTimeoutError):
        asyncio.run(d._wait_for_outcome(page, timeout_s=5))
    assert "Escape" in page.keyboard.pressed


def test_generate_image_deterministic_raises_immediately():
    d = _driver([_FakePage({"text": "copyright violation"})])
    with pytest.raises(GenerationDeniedError) as ei:
        asyncio.run(d.generate_image("x", timeout_s=5, retry=RetryConfig(max_tries=3)))
    assert ei.value.kind == "deterministic"
    assert ei.value.conversation_id == "conv-1"


def test_generate_image_denial_then_success():
    import chatgpt_bridge.ui_driver as ud

    async def fake_save(src, out_dir, ctx):
        from pathlib import Path

        return Path("/tmp/fake.png")

    ud.save_image = fake_save

    class _Browser:
        async def context(self):
            class _Ctx:
                request = None

            return _Ctx()

    d = _driver(
        [
            _FakePage({"text": "content policy violation"}),
            _SequencePage(
                [
                    {"loading": True},
                    {"loading": True},
                    {"image": True, "src": "https://x/estuary/content?id=file_abc123&sig=1", "alt": "Generated image: new"},
                ]
            ),
        ]
    )
    d.browser = _Browser()

    result = asyncio.run(
        d.generate_image("x", timeout_s=5, retry=RetryConfig(max_tries=2))
    )
    assert result["path"] == "/tmp/fake.png"
    assert result["conversation_id"] == "conv-1"


def test_generate_image_exhausted_raises():
    d = _driver([_FakePage({"text": "content policy violation"})])
    with pytest.raises(GenerationDeniedError) as ei:
        asyncio.run(d.generate_image("x", timeout_s=5, retry=RetryConfig(max_tries=2)))
    assert ei.value.kind == "denial"
    assert ei.value.conversation_id == "conv-1"


def test_generate_image_rate_limit_halts_immediately():
    d = _driver([_FakePage({"text": "image generation is temporarily rate-limited"})])
    with pytest.raises(GenerationDeniedError) as ei:
        asyncio.run(d.generate_image("x", timeout_s=5, retry=RetryConfig(max_tries=5)))
    assert ei.value.kind == "rate_limit"
    assert ei.value.conversation_id == "conv-1"


def test_generate_image_tweaks_prompt_on_retry_6():
    edited_prompts = []

    class _MockPage(_FakePage):
        def __init__(self):
            super().__init__({"text": "content policy violation"})

    d = UIDriver.__new__(UIDriver)
    d.browser = None
    d.session = None

    async def fake_page(cid=None):
        return _MockPage()

    async def fake_submit(page, prompt):
        return None

    async def fake_edit(page, new_prompt=None):
        edited_prompts.append(new_prompt)
        return True

    async def fake_outcome(page, timeout_s, auto_retry=False):
        return {"kind": "denial", "text": "content policy violation"}

    async def fake_cid(p):
        return "conv-1"

    d._page = fake_page
    d._submit_prompt = fake_submit
    d._edit_message_retry = fake_edit
    d._wait_for_outcome = fake_outcome
    d._current_conversation_id = fake_cid

    # Config with 6 tries and 0s delay for instant test
    cfg = RetryConfig(max_tries=6, intervals=(0, 0, 0, 0, 0, 0))
    with pytest.raises(GenerationDeniedError):
        asyncio.run(
            d.generate_image(
                "base prompt",
                timeout_s=1,
                retry=cfg,
                tweaked_prompt="tweaked prompt",
            )
        )

    # Retries 1 to 5 should pass new_prompt=None (keep base prompt)
    assert edited_prompts[:5] == [None, None, None, None, None]
    # Retry 6 should pass new_prompt="tweaked prompt"
    assert edited_prompts[5] == "tweaked prompt"


def test_delivered_image_cache_excludes_prior_images():
    page = _FakePage(
        {"image": True, "src": "https://x/estuary/content?id=file_delivered_999&sig=1"}
    )
    d = UIDriver.__new__(UIDriver)
    d._delivered_image_ids = {"file_delivered_999"}
    # Because file_delivered_999 is already marked delivered, _find_new_image_src must return None
    res = asyncio.run(d._find_new_image_src(page, set()))
    assert res is None


def test_conversation_continuity_denial_does_not_return_prompt1_image():
    # Prompt 1 image is in the DOM, but Prompt 2 receives a guardrail denial
    page = _FakePage(
        {
            "image": True,
            "src": "https://x/estuary/content?id=file_prompt_1&sig=1",
            "text": "We’re so sorry, but the image we created may violate our guardrails around nudity, sexuality, or ero",
        }
    )
    d = UIDriver.__new__(UIDriver)
    d._delivered_image_ids = {"file_prompt_1"}
    # Because file_prompt_1 was delivered for Prompt 1 and Prompt 2 was denied,
    # _wait_for_outcome must return denial, NOT the old image!
    outcome = asyncio.run(d._wait_for_outcome(page, timeout_s=3, auto_retry=False))
    assert outcome["kind"] == "denial"
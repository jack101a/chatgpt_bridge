"""Unit tests for the image retry loop using scripted fake pages."""

from __future__ import annotations

import asyncio

import pytest

from chatgpt_bridge.errors import GenerationDeniedError
from chatgpt_bridge.retry import RetryConfig
from chatgpt_bridge.ui_driver import UIDriver


class _FakeLocator:
    def __init__(self, count: int = 0, src: str | None = None, text: str = "") -> None:
        self._count = count
        self._src = src
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

    def __init__(self, state: dict) -> None:
        self._state = state
        self.keyboard = _FakeKeyboard()
        self.url = "https://chatgpt.com/c/conv-1"

    def locator(self, selector: str):
        cur = self._state
        if selector == "button":
            return _FakeLocator(
                count=1 if cur.get("try_again") else 0,
                text="Try again" if cur.get("try_again") else "",
            )
        if "Switch model" in selector:
            return _FakeLocator(count=1 if cur.get("switch_model") else 0)
        if "image-gen-loading" in selector:
            return _FakeLocator(count=1 if cur.get("loading") else 0)
        if "conversation-turn" in selector:
            return _FakeLocator(count=1, text=cur.get("text", ""))
        # IMAGE_SELECTOR (alt/src based)
        return _FakeLocator(count=1 if cur.get("image") else 0, src=cur.get("src"))

    async def close(self):
        pass


def _driver(pages):
    """Build a UIDriver whose _page() returns successive pages from ``pages``.

    Once the list is exhausted, the last page is returned repeatedly.
    """
    d = UIDriver.__new__(UIDriver)
    d.browser = None
    d.session = None
    it = iter(pages)
    last = pages[-1]

    async def fake_page():
        return next(it, last)

    d._page = fake_page

    async def fake_submit(page, prompt):
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
    out = _outcome({"image": True, "src": "https://x/img.png"})
    assert out == {"kind": "image", "src": "https://x/img.png"}


def test_outcome_try_again_clicked():
    out = _outcome({"try_again": True})
    assert out == {"kind": "retrying"}


def test_outcome_deterministic():
    out = _outcome({"text": "too similar to third-party content (copyright)"})
    assert out["kind"] == "deterministic"


def test_outcome_denial_switch_model_fallback():
    # denial text, no try-again button, but switch-model popover reveals one
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
    out = asyncio.run(d._wait_for_outcome(page, timeout_s=5))
    assert out == {"kind": "retrying"}
    assert "Escape" in page.keyboard.pressed


def test_generate_image_deterministic_raises_immediately():
    d = _driver([_FakePage({"text": "copyright violation"})])
    with pytest.raises(GenerationDeniedError) as ei:
        asyncio.run(d.generate_image("x", timeout_s=5, retry=RetryConfig(max_tries=3)))
    assert ei.value.kind == "deterministic"


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
            _FakePage({"image": True, "src": "https://x/img.png"}),
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
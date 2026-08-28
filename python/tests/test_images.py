"""Unit tests for image wait/download logic using a fake page."""

from __future__ import annotations

import asyncio
import base64

import pytest

from chatgpt_bridge.errors import BridgeTimeoutError
from chatgpt_bridge.images import save_image, wait_for_image


class _FakeLocator:
    def __init__(self, src: str | None) -> None:
        self._src = src

    @property
    def first(self):
        return self

    async def count(self) -> int:
        return 1 if self._src else 0

    async def get_attribute(self, name: str) -> str | None:
        return self._src


class _FakePage:
    """Fake page whose image appears after a number of polls."""

    def __init__(self, appear_after: int, src: str = "https://x/img.png") -> None:
        self._appear_after = appear_after
        self._polls = 0
        self._src = src

    def locator(self, selector: str):
        # Support the `.first` accessor used by _find_image_src.
        return _FakeLocator(self._src if self._polls >= self._appear_after else None)

    async def _tick(self):
        self._polls += 1


async def _poll(page, timeout_s: int) -> str:
    # Drive wait_for_image but advance the fake page's poll counter each loop.
    async def run():
        return await wait_for_image(page, timeout_s=timeout_s)

    task = asyncio.ensure_future(run())
    while not task.done():
        await page._tick()
        await asyncio.sleep(0.01)
    return task.result()


def test_wait_for_image_returns_src_when_it_appears():
    page = _FakePage(appear_after=3)
    src = asyncio.run(_poll(page, timeout_s=10))
    assert src == "https://x/img.png"


def test_wait_for_image_times_out():
    page = _FakePage(appear_after=999)
    with pytest.raises(BridgeTimeoutError):
        asyncio.run(_poll(page, timeout_s=1))


def test_save_image_data_url(tmp_path):
    png = b"\x89PNG\r\n\x1a\nfakepng"
    b64 = base64.b64encode(png).decode()
    src = f"data:image/png;base64,{b64}"
    path = asyncio.run(save_image(src, tmp_path, ctx=None))
    assert path.exists()
    assert path.read_bytes() == png
    assert path.suffix == ".png"


def test_save_image_remote_url(tmp_path):
    class _FakeResp:
        status = 200

        async def body(self) -> bytes:
            return b"remote-bytes"

    class _FakeCtx:
        async def get(self, url: str):
            return _FakeResp()

    path = asyncio.run(save_image("https://x/img.png", tmp_path, _FakeCtx()))
    assert path.exists()
    assert path.read_bytes() == b"remote-bytes"


def test_save_image_remote_error_raises(tmp_path):
    class _FakeResp:
        status = 404

        async def body(self) -> bytes:
            return b""

    class _FakeCtx:
        async def get(self, url: str):
            return _FakeResp()

    with pytest.raises(BridgeTimeoutError):
        asyncio.run(save_image("https://x/img.png", tmp_path, _FakeCtx()))
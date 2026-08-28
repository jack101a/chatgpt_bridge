"""Unit tests for session logic that does not require a live browser."""

from __future__ import annotations

import json

import pytest

from chatgpt_bridge.cookies import SESSION_COOKIE
from chatgpt_bridge.errors import (
    AuthError,
    BridgeTimeoutError,
    DaemonUnreachableError,
    ShapeChangedError,
)
from chatgpt_bridge.session import SessionManager


class _FakeBrowser:
    """Minimal BrowserManager stand-in capturing context interactions."""

    def __init__(self) -> None:
        self.added_cookies: list[list[dict]] = []

    async def context(self):
        return self

    async def add_cookies(self, cookies: list[dict]) -> None:
        self.added_cookies.append(cookies)


def _cookie(name: str, value: str = "v") -> dict:
    return {
        "name": name,
        "value": value,
        "domain": ".chatgpt.com",
        "path": "/",
        "expires": -1,
        "secure": True,
        "httpOnly": True,
        "sameSite": "Lax",
    }


def test_error_classes_are_derived_correctly():
    assert issubclass(AuthError, RuntimeError)
    assert issubclass(ShapeChangedError, RuntimeError)
    assert issubclass(BridgeTimeoutError, TimeoutError)
    assert issubclass(DaemonUnreachableError, RuntimeError)


def test_import_cookie_file_sets_pending_import(tmp_path):
    browser = _FakeBrowser()
    mgr = SessionManager(browser)

    raw = [_cookie(SESSION_COOKIE, "tok")]
    p = tmp_path / "cookies.json"
    p.write_text(json.dumps(raw), encoding="utf-8")

    mgr.import_cookie_file(p)
    assert mgr._pending_import is not None
    assert mgr._pending_import[0]["name"] == SESSION_COOKIE


def test_apply_pending_import_injects_and_clears(tmp_path):
    browser = _FakeBrowser()
    mgr = SessionManager(browser)

    raw = [_cookie(SESSION_COOKIE, "tok")]
    p = tmp_path / "cookies.json"
    p.write_text(json.dumps(raw), encoding="utf-8")

    mgr.import_cookie_file(p)
    import asyncio

    asyncio.run(mgr.apply_pending_import())

    assert len(browser.added_cookies) == 1
    assert browser.added_cookies[0][0]["name"] == SESSION_COOKIE
    assert mgr._pending_import is None


def test_apply_pending_import_noop_when_none(tmp_path):
    browser = _FakeBrowser()
    mgr = SessionManager(browser)
    import asyncio

    asyncio.run(mgr.apply_pending_import())
    assert browser.added_cookies == []


def test_import_cookie_file_missing_raises(tmp_path):
    browser = _FakeBrowser()
    mgr = SessionManager(browser)
    with pytest.raises(Exception):
        mgr.import_cookie_file(tmp_path / "nope.json")
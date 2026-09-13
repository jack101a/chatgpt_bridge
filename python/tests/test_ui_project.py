"""Unit tests for ChatGPT Project / Folder Isolation in UIDriver."""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock

from chatgpt_bridge.ui_driver import HOME_URL, UIDriver


class _FakeBrowserContext:
    def __init__(self, page):
        self._page = page

    async def new_page(self):
        return self._page


class _FakeBrowserManager:
    def __init__(self, page):
        self._page = page

    async def context(self):
        return _FakeBrowserContext(self._page)


class _MockPlaywrightPage:
    def __init__(self, initial_url: str = HOME_URL):
        self.url = initial_url
        self._is_closed = False
        self.nav_history: list[str] = []
        self.evaluate_mock = AsyncMock()

    def is_closed(self) -> bool:
        return self._is_closed

    async def close(self) -> None:
        self._is_closed = True

    async def goto(self, url: str, wait_until: str = "domcontentloaded", timeout: int = 60000):
        self.nav_history.append(url)
        self.url = url

    async def evaluate(self, script, *args):
        return await self.evaluate_mock(script, *args)


def test_project_isolation_disabled_by_default(monkeypatch):
    async def _run():
        monkeypatch.delenv("CHATGPT_BRIDGE_PROJECT_NAME", raising=False)
        fake_page = _MockPlaywrightPage()
        driver = UIDriver(browser=_FakeBrowserManager(fake_page), session=MagicMock())

        assert driver.project_name == ""
        assert driver._project_id is None

        result = await driver._ensure_bot_project(fake_page)
        assert result is None

        page = await driver._page()
        assert page.url == HOME_URL
        assert driver._project_id is None

    asyncio.run(_run())


def test_project_isolation_discovery_success(monkeypatch):
    async def _run():
        monkeypatch.setenv("CHATGPT_BRIDGE_PROJECT_NAME", "Telegram Bot")
        fake_page = _MockPlaywrightPage()
        fake_page.evaluate_mock.return_value = "g-p-test-proj-99"

        driver = UIDriver(browser=_FakeBrowserManager(fake_page), session=MagicMock())
        assert driver.project_name == "Telegram Bot"

        page = await driver._page()
        assert driver._project_id == "g-p-test-proj-99"
        assert page.url == "https://chatgpt.com/g/g-p-test-proj-99"
        assert HOME_URL in fake_page.nav_history
        assert "https://chatgpt.com/g/g-p-test-proj-99" in fake_page.nav_history

    asyncio.run(_run())


def test_project_isolation_redirect_fallback(monkeypatch):
    async def _run():
        monkeypatch.setenv("CHATGPT_BRIDGE_PROJECT_NAME", "Telegram Bot")
        fake_page = _MockPlaywrightPage()
        fake_page.evaluate_mock.return_value = "g-p-restricted"

        # Simulate redirect back to HOME_URL when navigating to project URL
        original_goto = fake_page.goto

        async def goto_with_redirect(url: str, **kwargs):
            await original_goto(url, **kwargs)
            if "g-p-restricted" in url:
                fake_page.url = HOME_URL

        fake_page.goto = goto_with_redirect

        driver = UIDriver(browser=_FakeBrowserManager(fake_page), session=MagicMock())
        page = await driver._page()

        # Should detect redirect and clear _project_id back to None
        assert driver._project_id is None
        assert page.url == HOME_URL

    asyncio.run(_run())


def test_project_isolation_eval_error_handled_gracefully(monkeypatch):
    async def _run():
        monkeypatch.setenv("CHATGPT_BRIDGE_PROJECT_NAME", "Telegram Bot")
        fake_page = _MockPlaywrightPage()
        fake_page.evaluate_mock.side_effect = RuntimeError("Network or CSP failure")

        driver = UIDriver(browser=_FakeBrowserManager(fake_page), session=MagicMock())
        res = await driver._ensure_bot_project(fake_page)
        assert res is None

        page = await driver._page()
        assert page.url == HOME_URL
        assert driver._project_id is None

    asyncio.run(_run())

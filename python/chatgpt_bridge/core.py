"""Public core API for chatgpt-bridge."""

from __future__ import annotations

import asyncio

from .browser import BrowserManager
from .errors import AuthError, ShapeChangedError
from .http_client import BackendClient
from .session import SessionManager
from .ui_driver import UIDriver


class ChatGPT:
    """Prompt ChatGPT (web session) for text and images.

    Uses the fast backend-api HTTP path first, falling back to the UI driver
    when the HTTP shape drifts.
    """

    def __init__(self, headless: bool = True, auto_relogin: bool = False) -> None:
        self.headless = headless
        self.auto_relogin = auto_relogin
        self.browser = BrowserManager(headless=headless)
        self.session = SessionManager(self.browser)
        self.http = BackendClient(self.session)
        self.ui = UIDriver(self.browser, self.session)
        self._started = False

    async def _ensure_started(self) -> None:
        if self._started:
            return
        await self.browser.start()
        await self.session.apply_pending_import()
        if not await self.session.is_alive():
            if self.auto_relogin:
                await self.session.login_flow()
            else:
                raise AuthError(
                    "No valid ChatGPT session. Re-login or refresh cookies, "
                    "or construct with auto_relogin=True."
                )
        self._started = True

    async def ask(
        self,
        prompt: str,
        model: str | None = None,
        conversation_id: str | None = None,
    ) -> dict:
        """Return ``{"text", "conversation_id"}``.

        Tries the backend HTTP path first; on :class:`ShapeChangedError`
        falls back to the UI driver.
        """
        await self._ensure_started()
        try:
            return await self.http.ask(prompt, conversation_id=conversation_id)
        except ShapeChangedError:
            return await self.ui.ask(prompt, conversation_id=conversation_id)

    async def generate_image(self, prompt: str, timeout_s: int = 180) -> dict:
        """Generate an image via the UI and return ``{"path", "prompt"}``."""
        await self._ensure_started()
        return await self.ui.generate_image(prompt, timeout_s=timeout_s)

    def close(self) -> None:
        """Synchronously stop the browser."""
        if self._started:
            asyncio.run(self.browser.stop())
            self._started = False

    # Sync sugar.
    def ask_sync(self, prompt: str, model: str | None = None, conversation_id: str | None = None) -> dict:
        return asyncio.run(self.ask(prompt, model=model, conversation_id=conversation_id))

    def generate_image_sync(self, prompt: str, timeout_s: int = 180) -> dict:
        return asyncio.run(self.generate_image(prompt, timeout_s=timeout_s))
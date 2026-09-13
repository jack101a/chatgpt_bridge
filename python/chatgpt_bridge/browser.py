"""Playwright persistent-context browser manager.

Owns a single persistent Chromium profile under ``~/.chatgpt-bridge/profile``
so a logged-in session survives across runs.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from playwright.async_api import async_playwright

from .errors import AuthError

# State directory lives in the user's home.
STATE_DIR = Path(os.environ.get("CHATGPT_BRIDGE_STATE", "~/.chatgpt-bridge")).expanduser()
PROFILE_DIR = STATE_DIR / "profile"


class BrowserManager:
    """Launch and manage a persistent Playwright Chromium context."""

    def __init__(self, headless: bool = True) -> None:
        self.headless = headless
        self._playwright: Any = None
        self._context: Any = None

    async def start(self) -> None:
        """Launch the persistent context at ``PROFILE_DIR``."""
        if self._context is not None:
            return
        PROFILE_DIR.mkdir(parents=True, exist_ok=True)
        for lock in PROFILE_DIR.glob("Singleton*"):
            try:
                lock.unlink()
            except Exception:
                pass
        # Clear crash session files so Chromium opens cleanly without restore bubbles
        sessions_dir = PROFILE_DIR / "Default" / "Sessions"
        if sessions_dir.exists():
            for f in sessions_dir.glob("*"):
                try:
                    f.unlink()
                except Exception:
                    pass

        pref_file = PROFILE_DIR / "Default" / "Preferences"
        if pref_file.exists():
            try:
                import json
                pref_data = json.loads(pref_file.read_text(encoding="utf-8"))
                if "profile" in pref_data:
                    pref_data["profile"]["exit_type"] = "Normal"
                    pref_data["profile"]["exited_cleanly"] = True
                pref_file.write_text(json.dumps(pref_data), encoding="utf-8")
            except Exception:
                pass

        self._playwright = await async_playwright().start()
        self._context = await self._playwright.chromium.launch_persistent_context(
            user_data_dir=str(PROFILE_DIR),
            headless=self.headless,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--window-size=1920,1080",
                "--start-maximized",
                "--disable-session-crashed-bubble",
                "--hide-crash-restore-bubble",
                "--no-first-run",
                "--no-default-browser-check",
            ],
            no_viewport=True,
        )

    async def context(self):
        """Return the Playwright ``BrowserContext``, starting it if needed."""
        if self._context is None:
            await self.start()
        return self._context

    async def ensure_logged_in(self) -> None:
        """Ensure the persistent context has a live ChatGPT session.

        Raises :class:`AuthError` if the session endpoint is unreachable or
        reports an unauthenticated user.
        """
        ctx = await self.context()
        page = await ctx.new_page()
        try:
            resp = await page.request.get(
                "https://chatgpt.com/api/auth/session",
                timeout=15_000,
            )
            if resp.status != 200:
                raise AuthError(
                    "ChatGPT session check failed "
                    f"(status {resp.status}); re-login or refresh cookies."
                )
            data = await resp.json()
            if not data or not data.get("user"):
                raise AuthError(
                    "ChatGPT session is not authenticated; "
                    "re-login or refresh cookies."
                )
        finally:
            await page.close()

    async def stop(self) -> None:
        """Close the context and stop Playwright."""
        if self._context is not None:
            await self._context.close()
            self._context = None
        if self._playwright is not None:
            await self._playwright.stop()
            self._playwright = None
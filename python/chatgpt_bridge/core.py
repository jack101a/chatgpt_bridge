"""Public core API for chatgpt-bridge."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from pathlib import Path

from .account import AccountInfo, AccountManager
from .browser import BrowserManager
from .chat_pool import DEFAULT_MAX_CHATS, ChatPoolManager
from .errors import AuthError, GenerationDeniedError, ShapeChangedError
from .http_client import BackendClient
from .retry import RetryConfig, parse_rate_limit_info, standardize_image_prompt
from .session import SessionManager
from .ui_driver import UIDriver

log = logging.getLogger(__name__)


class ChatGPT:
    """Prompt ChatGPT (web session) for text and images.

    Uses the fast backend-api HTTP path first, falling back to the UI driver
    when the HTTP shape drifts.
    """

    def __init__(
        self,
        headless: bool = True,
        auto_relogin: bool = False,
        max_chats: int | None = None,
        max_retries: int | None = None,
        use_http: bool = True,
        idle_timeout_s: int | None = None,
        account_manager: AccountManager | None = None,
    ) -> None:
        self.headless = headless
        self.auto_relogin = auto_relogin
        self.max_retries = (
            max_retries
            if max_retries is not None
            else int(os.environ.get("MAX_RETRIES", "10"))
        )
        self.idle_timeout_s = (
            idle_timeout_s
            if idle_timeout_s is not None
            else int(os.environ.get("BROWSER_IDLE_TIMEOUT_S", "300"))
        )
        self.use_http = use_http
        self.account_manager = account_manager or AccountManager()
        active_acc = self.account_manager.get_active_account()
        self.browser = BrowserManager(headless=headless, profile_dir=active_acc.profile_dir)
        self.session = SessionManager(self.browser)
        self.http = BackendClient(self.session)
        self.ui = UIDriver(self.browser, self.session)
        self.pool = ChatPoolManager(
            self.session,
            state_path=active_acc.chat_pool_file,
            max_chats=max_chats if max_chats is not None else DEFAULT_MAX_CHATS,
        )
        self._started = False
        self._loop: asyncio.AbstractEventLoop | None = None
        self._idle_task: asyncio.Task | None = None
        self._last_activity = time.monotonic()
        # Current conversation for continuity: text and image prompts continue
        # in the same chat until new_chat() is called.
        self._current_conversation_id: str | None = None

    def _touch_browser_activity(self) -> None:
        self._last_activity = time.monotonic()
        if self.idle_timeout_s > 0:
            if self._idle_task and not self._idle_task.done():
                self._idle_task.cancel()
            try:
                loop = asyncio.get_running_loop()
                self._idle_task = loop.create_task(self._idle_sleep_worker())
            except RuntimeError:
                pass

    async def _idle_sleep_worker(self) -> None:
        try:
            while True:
                idle_elapsed = time.monotonic() - self._last_activity
                remaining = self.idle_timeout_s - idle_elapsed
                if remaining <= 0:
                    break
                await asyncio.sleep(remaining)
            if self._started and self.browser._context is not None:
                log.info(
                    "Browser idle for %ds; shutting down to free RAM/CPU.",
                    self.idle_timeout_s,
                )
                await self.browser.stop()
                self._started = False
        except asyncio.CancelledError:
            pass

    def _get_loop(self) -> asyncio.AbstractEventLoop:
        if self._loop is None or self._loop.is_closed():
            self._loop = asyncio.new_event_loop()
        return self._loop

    async def _ensure_started(self) -> None:
        if self._started and self.browser._context is not None:
            self._touch_browser_activity()
            return
        await self.browser.start()
        self._touch_browser_activity()
        active_acc = self.account_manager.get_active_account()
        await self.session.apply_pending_import()
        if not await self.session.is_alive():
            # Try per-account cookies first, then default cookies
            if active_acc.cookies_file and Path(active_acc.cookies_file).exists():
                await self.session.try_cookie_login(active_acc.cookies_file)
            else:
                await self.session.try_cookie_login()

        if not await self.session.is_alive():
            if self.auto_relogin:
                await self.session.login_flow(cookie_path=active_acc.cookies_file or None)
            else:
                raise AuthError(
                    f"No valid ChatGPT session for account '{active_acc.alias}'. "
                    "Re-login or refresh cookies."
                )
        self._started = True
        try:
            if not active_acc.email or not active_acc.is_authenticated:
                user_info = await self.session.get_user_info()
                if user_info and user_info.get("email"):
                    self.account_manager.update_identity(
                        active_acc.id,
                        email=user_info.get("email", ""),
                        name=user_info.get("name", ""),
                    )
        except Exception:
            pass

    async def switch_account(self, account_id_or_alias: str) -> AccountInfo:
        """Switch the active account, stopping current browser context and loading the new profile."""
        await self.aclose()
        acc = self.account_manager.set_active_account(account_id_or_alias)
        self.browser = BrowserManager(headless=self.headless, profile_dir=acc.profile_dir)
        self.session = SessionManager(self.browser)
        self.http = BackendClient(self.session)
        self.ui = UIDriver(self.browser, self.session)
        self.pool = ChatPoolManager(
            self.session,
            state_path=acc.chat_pool_file,
            max_chats=self.pool.max_chats,
        )
        self._current_conversation_id = None
        return acc

    async def login_account(
        self,
        account_id_or_alias: str,
        cookies: list[dict] | str | Path,
    ) -> dict:
        """Authenticate a specific account using cookies, verify session, and store identity."""
        acc = self.account_manager.find_account(account_id_or_alias)
        if not acc:
            raise KeyError(f"Account not found: {account_id_or_alias}")

        from .cookies import parse_cookie_text, cookies_valid
        if isinstance(cookies, (str, Path)):
            if isinstance(cookies, Path) or (
                isinstance(cookies, str)
                and (cookies.endswith(".json") or cookies.endswith(".txt"))
                and Path(cookies).exists()
            ):
                text = Path(cookies).read_text(encoding="utf-8")
            else:
                text = str(cookies)
            cookie_list = parse_cookie_text(text)
        elif isinstance(cookies, list):
            cookie_list = cookies
        else:
            raise TypeError(f"Unsupported cookie type: {type(cookies)}")

        if not cookies_valid(cookie_list):
            raise ValueError(
                "Provided cookies do not contain a valid, unexpired ChatGPT session-token. "
                "Ensure you export cookies while logged into chatgpt.com."
            )

        # Save to account cookies_file
        cookie_file = Path(acc.cookies_file or (self.account_manager.accounts_root / acc.id / "cookies.json"))
        cookie_file.parent.mkdir(parents=True, exist_ok=True)
        cookie_file.write_text(json.dumps(cookie_list, indent=2), encoding="utf-8")
        acc.cookies_file = str(cookie_file)

        # If active browser is running on this profile, close it first
        is_active = self.account_manager.active_account_id == acc.id
        if self._started and is_active:
            await self.aclose()

        # Launch temporary browser context to apply cookies and harvest identity
        from .browser import BrowserManager
        bm = BrowserManager(headless=self.headless, profile_dir=acc.profile_dir)
        try:
            ctx = await bm.context()
            await ctx.add_cookies(cookie_list)
            page = await ctx.new_page()
            user_info = {}
            try:
                resp = await page.request.get(
                    "https://chatgpt.com/api/auth/session",
                    timeout=15_000,
                )
                if resp.status == 200:
                    data = await resp.json()
                    user_info = (data or {}).get("user") or {}
            except Exception as direct_err:
                log.debug("direct session check failed: %s", direct_err)

            # If direct API check didn't return user, navigate to chatgpt.com to let Cloudflare/session settle
            if not user_info:
                try:
                    await page.goto("https://chatgpt.com", wait_until="domcontentloaded", timeout=20_000)
                    resp = await page.request.get(
                        "https://chatgpt.com/api/auth/session",
                        timeout=15_000,
                    )
                    if resp.status == 200:
                        data = await resp.json()
                        user_info = (data or {}).get("user") or {}
                except Exception as nav_err:
                    log.warning("navigation session check error: %s", nav_err)

            await page.close()

            if not user_info:
                raise AuthError(
                    "ChatGPT session verification failed (session endpoint did not return an authenticated user). "
                    "Please ensure you were logged in when exporting cookies."
                )

            email = user_info.get("email", "")
            name = user_info.get("name", "")
            self.account_manager.update_identity(acc.id, email=email, name=name)
            acc.is_authenticated = True
            self.account_manager._save()
            return {"ok": True, "account": acc, "email": email, "name": name}
        finally:
            await bm.stop()

    async def ask(
        self,
        prompt: str,
        model: str | None = None,
        conversation_id: str | None = None,
    ) -> dict:
        """Return ``{"text", "conversation_id"}``.

        Continues the current conversation (or ``conversation_id`` if given);
        starts a fresh chat when neither exists. Tries the backend HTTP path
        first; on :class:`ShapeChangedError` falls back to the UI driver.
        """
        await self._ensure_started()
        cid = conversation_id or self._current_conversation_id
        if self.use_http:
            try:
                result = await self.http.ask(prompt, conversation_id=cid)
            except ShapeChangedError:
                result = await self.ui.ask(prompt, conversation_id=cid)
        else:
            result = await self.ui.ask(prompt, conversation_id=cid)
        self._current_conversation_id = result.get("conversation_id") or self._current_conversation_id
        await self._track(result.get("conversation_id"))
        return result

    async def generate_image(
        self,
        prompt: str,
        timeout_s: int = 180,
        max_retries: int | None = None,
        conversation_id: str | None = None,
        retry: RetryConfig | None = None,
        tweaked_prompt: str | None = None,
        tweaked_prompt_2: str | None = None,
    ) -> dict:
        """Generate an image via the UI, continuing the current conversation."""
        prompt = standardize_image_prompt(prompt)
        await self._ensure_started()
        cid = conversation_id or self._current_conversation_id
        if retry is None:
            retries = max_retries if max_retries is not None else self.max_retries
            retry = RetryConfig(max_tries=retries)
        kwargs: dict = {}
        if tweaked_prompt is not None:
            kwargs["tweaked_prompt"] = tweaked_prompt
        if tweaked_prompt_2 is not None:
            kwargs["tweaked_prompt_2"] = tweaked_prompt_2
        try:
            result = await self.ui.generate_image(
                prompt,
                timeout_s=timeout_s,
                retry=retry,
                conversation_id=cid,
                **kwargs,
            )
            active_acc = self.account_manager.get_active_account()
            self.account_manager.record_generation_success(active_acc.id)
            self._current_conversation_id = result.get("conversation_id") or self._current_conversation_id
            await self._track(result.get("conversation_id"))
            return result
        except GenerationDeniedError as exc:
            if exc.conversation_id:
                self._current_conversation_id = exc.conversation_id
                await self._track(exc.conversation_id)
            if exc.kind == "rate_limit":
                info = parse_rate_limit_info(str(exc))
                active_acc = self.account_manager.get_active_account()
                strikes, alt_acc = self.account_manager.record_rate_limit(
                    active_acc.id, info["wait_seconds"], info["resets_at_str"]
                )
                setattr(exc, "strikes", strikes)
                setattr(exc, "alt_account", alt_acc)
                setattr(exc, "rate_limit_info", info)
            raise
        finally:
            self._touch_browser_activity()

    def new_chat(self) -> None:
        """Reset the current conversation so the next prompt starts fresh."""
        self._current_conversation_id = None
        self.ui._active_cid = None

    async def delete_conversation(self, conversation_id: str) -> bool:
        """Delete a conversation by ID from ChatGPT history."""
        await self._ensure_started()
        try:
            res = await self.ui.delete_conversation(conversation_id)
            if conversation_id == self._current_conversation_id:
                self._current_conversation_id = None
            return res
        finally:
            self._touch_browser_activity()

    def delete_conversation_sync(self, conversation_id: str) -> bool:
        return self._get_loop().run_until_complete(self.delete_conversation(conversation_id))

    async def _track(self, conversation_id: str | None) -> None:
        """Record a bridge-created conversation and prune the oldest past the limit."""
        if not conversation_id:
            return
        self.pool.record(conversation_id)
        await self.pool.prune()

    async def aclose(self) -> None:
        """Asynchronously stop UI page and browser."""
        if self._started:
            await self.ui.close_page()
            await self.browser.stop()
            self._started = False

    def close(self) -> None:
        """Synchronously stop the browser."""
        if self._started:
            try:
                running_loop = asyncio.get_running_loop()
            except RuntimeError:
                running_loop = None

            if running_loop and running_loop.is_running():
                running_loop.create_task(self.aclose())
            else:
                loop = self._get_loop()
                loop.run_until_complete(self.aclose())

    # Sync sugar — all reuse one event loop (Playwright objects are loop-bound).
    def ask_sync(self, prompt: str, model: str | None = None, conversation_id: str | None = None) -> dict:
        return self._get_loop().run_until_complete(
            self.ask(prompt, model=model, conversation_id=conversation_id)
        )

    def generate_image_sync(
        self,
        prompt: str,
        timeout_s: int = 180,
        max_retries: int | None = None,
        conversation_id: str | None = None,
    ) -> dict:
        return self._get_loop().run_until_complete(
            self.generate_image(
                prompt,
                timeout_s=timeout_s,
                max_retries=max_retries,
                conversation_id=conversation_id,
            )
        )
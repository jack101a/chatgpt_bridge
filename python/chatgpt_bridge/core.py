"""Public core API for chatgpt-bridge."""

from __future__ import annotations

import asyncio
import contextlib
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
from .characters import CharacterCard
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
        auto_switch: bool | None = None,
        auto_switch_strikes: int | None = None,
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
        self.auto_switch = (
            auto_switch
            if auto_switch is not None
            else os.environ.get("CHATGPT_BRIDGE_AUTO_SWITCH", "1") not in ("0", "false", "no")
        )
        self.auto_switch_strikes = (
            auto_switch_strikes
            if auto_switch_strikes is not None
            else int(os.environ.get("CHATGPT_BRIDGE_AUTO_SWITCH_STRIKES", "1"))
        )
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
        self._busy_count: int = 0
        # Current conversation for continuity: text and image prompts continue
        # in the same chat until new_chat() is called.
        self._current_conversation_id: str | None = None

    @contextlib.asynccontextmanager
    async def _busy_guard(self):
        """Keep the browser marked active and prevent premature idle shutdowns."""
        self._busy_count += 1
        self._touch_browser_activity()
        try:
            yield
        finally:
            self._busy_count = max(0, self._busy_count - 1)
            self._touch_browser_activity()

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
                if self._busy_count > 0:
                    self._last_activity = time.monotonic()
                    await asyncio.sleep(self.idle_timeout_s)
                    continue
                idle_elapsed = time.monotonic() - self._last_activity
                remaining = self.idle_timeout_s - idle_elapsed
                if remaining <= 0:
                    break
                await asyncio.sleep(remaining)
            if self._busy_count > 0:
                return
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
        if self._started:
            if self.browser._context is not None:
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

    async def _check_proactive_switch(self) -> tuple[AccountInfo, str] | None:
        """If auto_switch is enabled and active account is rate-limited, switch to the healthiest alternative."""
        if not self.auto_switch:
            return None
        active_acc = self.account_manager.get_active_account()
        if active_acc.is_rate_limited():
            alt = self.account_manager.get_least_used_available_account(exclude_id=active_acc.id)
            if alt:
                prev_alias = active_acc.alias
                log.info(
                    "Active account '%s' is rate-limited until %s. Proactively auto-switching to '%s'.",
                    prev_alias,
                    active_acc.rate_limit_resets_at_str or "future",
                    alt.alias,
                )
                new_acc = await self.switch_account(alt.id)
                return (new_acc, prev_alias)
        return None

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
                    "ChatGPT session verification failed: The session endpoint returned no active user.\n"
                    "This usually means the cookies were exported from a logged-out tab or the session was revoked. "
                    "Please ensure you are actively logged into chatgpt.com (with the chat prompt visible) before exporting cookies."
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
        image_path: str | Path | None = None,
        image_paths: list[str | Path] | None = None,
    ) -> dict:
        """Return ``{"text", "conversation_id"}``.

        Continues the current conversation (or ``conversation_id`` if given);
        starts a fresh chat when neither exists. Tries the backend HTTP path
        first; on :class:`ShapeChangedError` or when images are attached falls back to the UI driver.
        """
        async with self._busy_guard():
            switched_from: str | None = None
            if self.auto_switch:
                switched = await self._check_proactive_switch()
                if switched:
                    _, switched_from = switched

            await self._ensure_started()
            if conversation_id and conversation_id.strip().lower() in ("new", "clean", "none", ""):
                self.new_chat()
                cid = None
            else:
                cid = conversation_id or self._current_conversation_id
            active_acc = self.account_manager.get_active_account()

            try:
                if (image_paths or image_path) or not self.use_http:
                    result = await self.ui.ask(
                        prompt,
                        conversation_id=cid,
                        image_path=image_path,
                        image_paths=image_paths,
                    )
                else:
                    try:
                        result = await self.http.ask(prompt, conversation_id=cid)
                    except ShapeChangedError:
                        result = await self.ui.ask(
                            prompt,
                            conversation_id=cid,
                            image_path=image_path,
                            image_paths=image_paths,
                        )
                self._current_conversation_id = result.get("conversation_id") or self._current_conversation_id
                await self._track(result.get("conversation_id"))
                result["account_used"] = active_acc.alias
                if switched_from:
                    result["switched_from"] = switched_from
                return result
            except GenerationDeniedError as exc:
                if exc.kind == "rate_limit" and self.auto_switch:
                    info = parse_rate_limit_info(str(exc))
                    strikes, alt_acc = self.account_manager.record_rate_limit(
                        active_acc.id,
                        info["wait_seconds"],
                        info["resets_at_str"],
                        min_strikes=self.auto_switch_strikes,
                    )
                    if alt_acc:
                        log.warning(
                            "Account '%s' rate-limited during ask (%d strikes). Auto-switching to '%s' and retrying...",
                            active_acc.alias,
                            strikes,
                            alt_acc.alias,
                        )
                        prev_alias = active_acc.alias
                        await self.switch_account(alt_acc.id)
                        await self._ensure_started()
                        retry_res = await self.ui.ask(
                            prompt,
                            conversation_id=None,
                            image_path=image_path,
                            image_paths=image_paths,
                        )
                        new_acc = self.account_manager.get_active_account()
                        self._current_conversation_id = retry_res.get("conversation_id") or self._current_conversation_id
                        await self._track(retry_res.get("conversation_id"))
                        retry_res["account_used"] = new_acc.alias
                        retry_res["switched_from"] = prev_alias
                        return retry_res
                raise

    async def establish_character_contract(
        self,
        character_card: CharacterCard,
        images_dir: Path | str | None = None,
        conversation_id: str | None = None,
        plot: str | None = None,
        roleplay_info: str | None = None,
        screenplay_handshake: str | None = None,
    ) -> dict:
        """Establish Turn 0 Character Identity Contract Handshake.

        Attaches all 3 reference cards simultaneously and submits the physical
        contract prompt to prime the conversation thread without generating an image.
        In roleplay/director mode, incorporates plot and roleplay info into the JSON.
        """
        paths = character_card.get_reference_card_paths(images_dir=images_dir)
        prompt = character_card.build_contract_handshake_prompt(
            plot=plot,
            roleplay_info=roleplay_info,
            screenplay_handshake=screenplay_handshake,
        )
        res = await self.ask(
            prompt,
            conversation_id=conversation_id,
            image_paths=paths,
        )
        cid = res.get("conversation_id")
        return {
            "ok": True,
            "conversation_id": cid,
            "character_id": character_card.id,
            "character_name": character_card.name,
            "card_count": len(paths),
            "text": res.get("text", ""),
        }

    async def generate_image(
        self,
        prompt: str,
        timeout_s: int = 180,
        max_retries: int | None = None,
        conversation_id: str | None = None,
        retry: RetryConfig | None = None,
        tweaked_prompt: str | None = None,
        tweaked_prompt_2: str | None = None,
        image_path: str | Path | None = None,
        image_paths: list[str | Path] | None = None,
        on_progress: Any | None = None,
    ) -> dict:
        """Generate an image via the UI, continuing the current conversation."""
        async with self._busy_guard():
            prompt = standardize_image_prompt(prompt)
            switched_from: str | None = None
            if self.auto_switch:
                switched = await self._check_proactive_switch()
                if switched:
                    _, switched_from = switched

            await self._ensure_started()
            if conversation_id and conversation_id.strip().lower() in ("new", "clean", "none", ""):
                self.new_chat()
                cid = None
            else:
                cid = conversation_id or self._current_conversation_id
            if retry is None:
                retries = max_retries if max_retries is not None else self.max_retries
                retry = RetryConfig(max_tries=retries)
            kwargs: dict = {}
            if tweaked_prompt is not None:
                kwargs["tweaked_prompt"] = tweaked_prompt
            if tweaked_prompt_2 is not None:
                kwargs["tweaked_prompt_2"] = tweaked_prompt_2
            if image_path is not None:
                kwargs["image_path"] = image_path
            if image_paths is not None:
                kwargs["image_paths"] = image_paths
            if on_progress is not None:
                kwargs["on_progress"] = on_progress
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
                result["account_used"] = active_acc.alias
                if switched_from:
                    result["switched_from"] = switched_from
                return result
            except GenerationDeniedError as exc:
                if exc.conversation_id:
                    self._current_conversation_id = exc.conversation_id
                    await self._track(exc.conversation_id)
                if exc.kind == "rate_limit":
                    info = parse_rate_limit_info(str(exc))
                    active_acc = self.account_manager.get_active_account()
                    strikes, alt_acc = self.account_manager.record_rate_limit(
                        active_acc.id,
                        info["wait_seconds"],
                        info["resets_at_str"],
                        min_strikes=self.auto_switch_strikes,
                    )
                    setattr(exc, "strikes", strikes)
                    setattr(exc, "alt_account", alt_acc)
                    setattr(exc, "rate_limit_info", info)

                    if self.auto_switch and alt_acc:
                        log.warning(
                            "Account '%s' hit rate limit (%d strikes). Auto-switching to '%s' and retrying prompt...",
                            active_acc.alias,
                            strikes,
                            alt_acc.alias,
                        )
                        prev_alias = active_acc.alias
                        await self.switch_account(alt_acc.id)
                        await self._ensure_started()
                        retry_result = await self.ui.generate_image(
                            prompt,
                            timeout_s=timeout_s,
                            retry=retry,
                            conversation_id=None,
                            **kwargs,
                        )
                        new_active = self.account_manager.get_active_account()
                        self.account_manager.record_generation_success(new_active.id)
                        self._current_conversation_id = (
                            retry_result.get("conversation_id") or self._current_conversation_id
                        )
                        await self._track(retry_result.get("conversation_id"))
                        retry_result["account_used"] = new_active.alias
                        retry_result["switched_from"] = prev_alias
                        return retry_result
                raise

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
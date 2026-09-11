"""UI fallback driver: drive chatgpt.com DOM via Playwright."""

from __future__ import annotations

import asyncio
import re
import time

from .browser import BrowserManager
from .errors import BridgeTimeoutError, GenerationDeniedError, ShapeChangedError
from .images import IMAGE_SELECTOR, save_image
from .retry import RetryConfig, classify_response, parse_rate_limit_wait
from .session import SessionManager

# Robust selectors, data-testid first.
COMPOSER_SELECTOR = (
    '[data-testid="composer-text-input"], div[contenteditable="true"]'
)
SEND_SELECTOR = '[data-testid="composer-send-button"]'
TURN_SELECTOR = '[data-testid^="conversation-turn"]'
ASSISTANT_SELECTOR = '[data-message-author-role="assistant"]'

# "Try again" button (transient dialog) and the Switch-model popover trigger.
TRY_AGAIN_RE = re.compile(r"try again|retry|regenerate", re.IGNORECASE)
SWITCH_MODEL_SELECTOR = 'button[aria-label="Switch model"]'
LOADING_SELECTOR = '[data-testid="image-gen-loading-state"]'

HOME_URL = "https://chatgpt.com/"


class UIDriver:
    """Drive the ChatGPT web UI as a fallback and for image generation."""

    def __init__(self, browser: BrowserManager, session: SessionManager) -> None:
        self.browser = browser
        self.session = session

    async def _page(self, conversation_id: str | None = None):
        ctx = await self.browser.context()
        page = await ctx.new_page()
        url = (
            f"https://chatgpt.com/c/{conversation_id}"
            if conversation_id
            else HOME_URL
        )
        # Navigate with retries: the box's network is flaky (ERR_NETWORK_CHANGED)
        # and /c/{id} loads are slower than the home page. Retry transient
        # failures up to 3 times with a short backoff.
        last_exc: Exception | None = None
        for attempt in range(3):
            try:
                await page.goto(
                    url,
                    wait_until="domcontentloaded",
                    timeout=60_000,
                )
                return page
            except Exception as exc:  # noqa: BLE001 — retry any nav failure
                last_exc = exc
                if attempt < 2:
                    await asyncio.sleep(2 * (attempt + 1))
        await page.close()
        raise last_exc  # type: ignore[misc]

    async def ask(
        self, prompt: str, conversation_id: str | None = None
    ) -> dict:
        """Submit a prompt via the composer and return ``{"text", ...}``.

        When ``conversation_id`` is given, the prompt continues that existing
        conversation; otherwise a fresh chat is started.
        """
        page = await self._page(conversation_id)
        try:
            await self._submit_prompt(page, prompt)
            text = await self._wait_for_answer(page)
            cid = conversation_id or await self._current_conversation_id(page)
            return {"text": text, "conversation_id": cid}
        finally:
            await page.close()

    async def generate_image(
        self,
        prompt: str,
        timeout_s: int = 180,
        retry: RetryConfig | None = None,
        conversation_id: str | None = None,
    ) -> dict:
        """Submit a prompt and wait for a generated image, retrying on denial.

        ``retry=None`` uses the default :class:`RetryConfig` (3 tries). Pass
        ``RetryConfig(max_tries=1)`` to disable retrying. The prompt is always
        sent verbatim. When ``conversation_id`` is given, the prompt continues
        that existing conversation; otherwise a fresh chat is started. Raises
        :class:`GenerationDeniedError` on deterministic denial or exhausted
        retries, :class:`BridgeTimeoutError` if no image ever appears.
        """
        cfg = retry or RetryConfig()
        last_kind = "no_image"
        last_text = ""
        tries = 0
        while tries < cfg.max_tries:
            tries += 1
            if tries > 1:
                await asyncio.sleep(cfg.delay_for(tries))
            page = await self._page(conversation_id)
            try:
                await self._submit_prompt(page, prompt)
                outcome = await self._wait_for_outcome(page, timeout_s)
                if outcome["kind"] == "image":
                    ctx = await self.browser.context()
                    path = await save_image(outcome["src"], _images_dir(), ctx.request)
                    cid = conversation_id or await self._current_conversation_id(page)
                    return {
                        "path": str(path),
                        "prompt": prompt,
                        "conversation_id": cid,
                    }
                if outcome["kind"] == "retrying":
                    # A "Try again" button was clicked; regeneration is in
                    # progress. Do not consume a try — keep waiting.
                    tries -= 1
                    continue
                last_kind = outcome["kind"]
                last_text = outcome.get("text", "")
                if last_kind == "deterministic":
                    raise GenerationDeniedError(
                        last_text[:200] or "deterministic denial",
                        kind="deterministic",
                    )
                if last_kind == "rate_limit":
                    wait_s = parse_rate_limit_wait(last_text)
                    if wait_s:
                        await asyncio.sleep(wait_s)
            finally:
                await page.close()
        raise GenerationDeniedError(
            f"image denied after {cfg.max_tries} tries (last: {last_kind})",
            kind=last_kind,
        )

    async def _wait_for_outcome(self, page, timeout_s: int) -> dict:
        """Poll until a NEW image, a settled denial, or a retry button appears.

        Under conversation continuity, prior images remain in the DOM and are
        lazy-loaded. Each generated image renders as 3 ``<img>`` elements
        sharing one ``src``, but the ``alt`` text (``"Generated image: <title>"``)
        is unique per generation and is the reliable discriminator. We snapshot
        the set of existing ``alt`` texts before submit, then wait for the
        loading state to appear+clear and a NEW ``alt`` to show up.

        Returns one of:
          {"kind": "image", "src": str}
          {"kind": "retrying"}
          {"kind": <classify_response kind>, "text": str}
        """
        deadline = time.monotonic() + timeout_s
        last_text = ""
        stable_polls = 0
        saw_loading = False
        existing: set[str] = set()

        while time.monotonic() < deadline:
            # 1. Generation in progress? Snapshot existing image alts the first
            #    time we see the loading state (prior images are now rendered).
            if await self._is_loading(page):
                if not saw_loading:
                    saw_loading = True
                    existing = await self._existing_image_alts(page)
                stable_polls = 0
                last_text = ""
                await asyncio.sleep(0.5)
                continue

            # 2. NEW image appeared (only after we've seen loading)? The new
            #    image may render a beat AFTER loading clears, so keep polling.
            if saw_loading:
                src = await self._find_new_image_src(page, existing)
                if src:
                    return {"kind": "image", "src": src}

            # 3. "Try again" button visible (transient) — click immediately.
            if await self._click_try_again(page):
                return {"kind": "retrying"}

            # 4. Settled assistant text?
            text = await self._read_last_assistant(page)
            if text and text == last_text:
                stable_polls += 1
                if stable_polls >= 4:
                    kind = classify_response(text)
                    if kind == "denial":
                        # No retry button seen — try the Switch-model popover.
                        if await self._switch_model_fallback(page):
                            return {"kind": "retrying"}
                    return {"kind": kind, "text": text}
            elif text:
                last_text = text
                stable_polls = 0
            await asyncio.sleep(0.5)

        raise BridgeTimeoutError(
            f"timed out after {timeout_s}s waiting for image outcome"
        )

    async def _existing_image_alts(self, page) -> set[str]:
        """Return the set of image ``alt`` texts currently in the DOM.

        The ``alt`` (``"Generated image: <title>"``) is unique per generation,
        unlike ``src`` which is shared by 3 duplicate ``<img>`` elements.
        """
        try:
            locator = page.locator(IMAGE_SELECTOR)
            count = await locator.count()
            alts: set[str] = set()
            for i in range(count):
                alt = await locator.nth(i).get_attribute("alt")
                if alt:
                    alts.add(alt)
            return alts
        except Exception:
            return set()

    async def _find_new_image_src(self, page, existing: set[str]) -> str | None:
        """Return the src of the most recent image whose ``alt`` is new.

        Iterates from last to first; returns the first image whose ``alt`` is
        not in ``existing`` (i.e. a newly generated image, not a prior one).
        """
        try:
            locator = page.locator(IMAGE_SELECTOR)
            count = await locator.count()
            for i in range(count - 1, -1, -1):
                alt = await locator.nth(i).get_attribute("alt")
                if alt and alt not in existing:
                    return await locator.nth(i).get_attribute("src")
            return None
        except Exception:
            return None

    async def _is_loading(self, page) -> bool:
        try:
            return await page.locator(LOADING_SELECTOR).count() > 0
        except Exception:
            return False

    async def _click_try_again(self, page) -> bool:
        """Click a visible "Try again"/"Retry"/"Regenerate" button if present."""
        try:
            buttons = page.locator("button")
            count = await buttons.count()
            for i in range(count):
                btn = buttons.nth(i)
                if not await btn.is_visible():
                    continue
                text = (await btn.inner_text()) or ""
                if TRY_AGAIN_RE.search(text):
                    await btn.click()
                    return True
        except Exception:
            pass
        return False

    async def _switch_model_fallback(self, page) -> bool:
        """Open the Switch-model popover and click its "Try again" if present.

        The popover (Radix UI) opens on pointerdown; dismiss any overlay with
        Escape first, then click the trigger and poll fast for the retry button.
        """
        try:
            await page.keyboard.press("Escape")
            await asyncio.sleep(0.15)
            trigger = page.locator(SWITCH_MODEL_SELECTOR).last
            if await trigger.count() == 0:
                return False
            await trigger.click()
            fast_start = time.monotonic()
            while time.monotonic() - fast_start < 2.0:
                if await self._click_try_again(page):
                    return True
                await asyncio.sleep(0.1)
        except Exception:
            pass
        return False

    async def _current_conversation_id(self, page) -> str:
        """Extract the conversation id from the URL (``/c/<id>``), else empty."""
        try:
            url = page.url
            if "/c/" in url:
                return url.split("/c/", 1)[1].split("/", 1)[0].split("?", 1)[0]
        except Exception:
            pass
        return ""

    async def _submit_prompt(self, page, prompt: str) -> None:
        composer = page.locator(COMPOSER_SELECTOR).first
        await composer.wait_for(state="visible", timeout=90_000)
        await composer.click()
        # Type characters: fill() doesn't fire the input events the
        # contenteditable ProseMirror composer needs.
        await page.keyboard.type(prompt, delay=10)
        await page.keyboard.press("Enter")

    async def _wait_for_answer(self, page, timeout_s: int = 120) -> str:
        """Poll assistant turns until the answer is stable across 2 polls."""
        deadline = time.monotonic() + timeout_s
        last_text = ""
        stable_polls = 0
        while time.monotonic() < deadline:
            text = await self._read_last_assistant(page)
            if text and text == last_text:
                stable_polls += 1
                if stable_polls >= 2:
                    return text
            elif text:
                last_text = text
                stable_polls = 0
            await asyncio.sleep(1.0)
        if last_text:
            return last_text
        raise ShapeChangedError("no assistant answer detected in UI")

    async def _read_last_assistant(self, page) -> str:
        try:
            turns = page.locator(TURN_SELECTOR)
            count = await turns.count()
            for i in range(count - 1, -1, -1):
                turn = turns.nth(i)
                if await turn.locator(ASSISTANT_SELECTOR).count() > 0:
                    return (await turn.inner_text()).strip()
        except Exception:
            pass
        return ""


def _images_dir():
    from pathlib import Path

    return Path("~/.chatgpt-bridge/images").expanduser()
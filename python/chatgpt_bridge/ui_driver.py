"""UI fallback driver: drive chatgpt.com DOM via Playwright."""

from __future__ import annotations

import asyncio
import logging
import re
import time

log = logging.getLogger("chatgpt_bridge.ui_driver")

from .browser import BrowserManager
from .errors import BridgeTimeoutError, GenerationDeniedError, ShapeChangedError
from .images import IMAGE_SELECTOR, save_image
from .retry import (
    RetryConfig,
    auto_tweak_prompt,
    classify_response,
    parse_rate_limit_wait,
)
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

_DIALOG_CHECK_JS = """() => {
    const dialogs = [...document.querySelectorAll('[role="dialog"]')].map(d => d.textContent || '').join(' ');
    const alerts = [...document.querySelectorAll('[role="alert"], .text-token-text-error')].map(d => d.textContent || '').join(' ');
    const combined = (dialogs + ' ' + alerts).trim();
    if (!combined) return { isLimited: false, text: '' };
    const isLimited = /too many requests|requests too quickly|rate limit|hourly limit|you've reached your limit/i.test(combined);
    return { isLimited, text: combined.slice(0, 300).trim() };
}"""

_DOM_TO_MD_JS = """() => {
    const assistantNodes = document.querySelectorAll('[data-message-author-role="assistant"]');
    if (!assistantNodes.length) return '';
    const last = assistantNodes[assistantNodes.length - 1];
    const root = last.querySelector('.markdown') || last;

    function nodeToMd(node) {
        if (!node) return '';
        if (node.nodeType === Node.TEXT_NODE) {
            return node.textContent;
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return '';

        const tag = node.tagName.toLowerCase();

        // Strip UI buttons and svg icons (Copy, Run, etc.)
        if (tag === 'button' || tag === 'svg') return '';

        if (tag === 'pre') {
            const codeEl = node.querySelector('code');
            let lang = '';
            if (codeEl) {
                const cls = codeEl.className || '';
                const m = cls.match(/language-([a-zA-Z0-9_+-]+)/);
                if (m) lang = m[1];
            }
            const codeText = codeEl ? codeEl.textContent : node.textContent;
            return '\\n```' + lang + '\\n' + codeText.replace(/\\n$/, '') + '\\n```\\n';
        }
        if (tag === 'code') {
            if (node.closest('pre')) return node.textContent;
            return '`' + node.textContent + '`';
        }
        if (tag === 'h1') return '\\n# ' + childrenToMd(node).trim() + '\\n';
        if (tag === 'h2') return '\\n## ' + childrenToMd(node).trim() + '\\n';
        if (tag === 'h3') return '\\n### ' + childrenToMd(node).trim() + '\\n';
        if (tag === 'h4') return '\\n#### ' + childrenToMd(node).trim() + '\\n';
        if (tag === 'strong' || tag === 'b') return '**' + childrenToMd(node) + '**';
        if (tag === 'em' || tag === 'i') return '*' + childrenToMd(node) + '*';
        if (tag === 's' || tag === 'del') return '~~' + childrenToMd(node) + '~~';
        if (tag === 'blockquote') {
            const inner = childrenToMd(node).trim();
            return '\\n' + inner.split('\\n').map(l => '> ' + l).join('\\n') + '\\n';
        }
        if (tag === 'li') return '- ' + childrenToMd(node).trim() + '\\n';
        if (tag === 'p') return childrenToMd(node) + '\\n\\n';
        if (tag === 'a') {
            const href = node.getAttribute('href') || '';
            return '[' + childrenToMd(node) + '](' + href + ')';
        }

        return childrenToMd(node);
    }

    function childrenToMd(node) {
        let res = '';
        for (const child of node.childNodes) {
            res += nodeToMd(child);
        }
        return res;
    }

    return nodeToMd(root).trim();
}"""


class UIDriver:
    """Drive the ChatGPT web UI as a fallback and for image generation."""

    _active_page = None
    _active_cid: str | None = None
    _delivered_image_ids: set[str] = set()

    def __init__(self, browser: BrowserManager, session: SessionManager) -> None:
        self.browser = browser
        self.session = session
        self._active_page = None
        self._active_cid = None
        self._delivered_image_ids = self._load_delivered_ids()

    def _load_delivered_ids(self) -> set[str]:
        try:
            p = _images_dir() / "delivered_ids.json"
            if p.exists():
                import json
                data = json.loads(p.read_text(encoding="utf-8"))
                if isinstance(data, list):
                    return set(data)
        except Exception:
            pass
        return set()

    def _record_delivered_id(self, fid: str) -> None:
        if not fid:
            return
        if not hasattr(self, "_delivered_image_ids") or self._delivered_image_ids is UIDriver._delivered_image_ids:
            self._delivered_image_ids = set(UIDriver._delivered_image_ids)
        self._delivered_image_ids.add(fid)
        try:
            p = _images_dir() / "delivered_ids.json"
            import json
            p.write_text(json.dumps(sorted(list(self._delivered_image_ids))), encoding="utf-8")
        except Exception:
            pass

    async def _save_image(self, src: str, out_dir, ctx_req, page=None):
        try:
            return await save_image(src, out_dir, ctx_req, page=page)
        except TypeError:
            return await save_image(src, out_dir, ctx_req)

    async def _page(self, conversation_id: str | None = None):
        # Reuse existing open page if already on the requested conversation
        if self._active_page is not None:
            try:
                is_closed = self._active_page.is_closed()
            except Exception:
                is_closed = True
            if not is_closed:
                if conversation_id and self._active_cid == conversation_id:
                    return self._active_page
                if not conversation_id and not self._active_cid and self._active_page.url == HOME_URL:
                    return self._active_page
                # Different conversation needed — close previous page
                try:
                    await self._active_page.close()
                except Exception:
                    pass
                self._active_page = None
                self._active_cid = None

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
                # If a specific conversation was requested, verify it did not redirect to HOME
                if conversation_id:
                    for _ in range(10):
                        cur_url = page.url
                        if f"/c/{conversation_id}" in cur_url or (cur_url != HOME_URL and "/c/" in cur_url):
                            break
                        await asyncio.sleep(0.4)
                    if page.url.rstrip("/") == HOME_URL.rstrip("/"):
                        await page.close()
                        raise RuntimeError(
                            f"Failed to load conversation {conversation_id}: redirected to home."
                        )
                    # Allow existing conversation turns and images to hydrate into DOM
                    try:
                        await page.locator(TURN_SELECTOR).first.wait_for(
                            state="attached", timeout=5000
                        )
                        await asyncio.sleep(0.5)
                    except Exception:
                        pass
                self._active_page = page
                self._active_cid = conversation_id
                return page
            except Exception as exc:  # noqa: BLE001 — retry any nav failure
                last_exc = exc
                if attempt < 2:
                    await asyncio.sleep(2 * (attempt + 1))
        await page.close()
        raise last_exc  # type: ignore[misc]

    async def close_page(self) -> None:
        """Close the currently active page/tab."""
        if self._active_page is not None:
            try:
                await self._active_page.close()
            except Exception:
                pass
            self._active_page = None
            self._active_cid = None

    async def ask(
        self, prompt: str, conversation_id: str | None = None
    ) -> dict:
        """Submit a prompt via the composer and return ``{"text", ...}``.

        When ``conversation_id`` is given, the prompt continues that existing
        conversation; otherwise a fresh chat is started.
        """
        page = await self._page(conversation_id)
        await self._submit_prompt(page, prompt)
        text = await self._wait_for_answer(page)
        cid = conversation_id or await self._current_conversation_id(page)
        self._active_cid = cid
        return {"text": text, "conversation_id": cid}

    async def generate_image(
        self,
        prompt: str,
        timeout_s: int = 180,
        retry: RetryConfig | None = None,
        conversation_id: str | None = None,
        tweaked_prompt: str | None = None,
        tweaked_prompt_2: str | None = None,
    ) -> dict:
        """Submit a prompt and wait for a generated image, retrying on denial.

        Retries up to ``cfg.max_tries`` times (default: 10) using progressive intervals
        (5s, 10s, 15s, 20s, 25s, 26s, 27s, 28s, 29s, 30s).
        On retries 1-5: re-submits the base prompt via the message edit button (pencil icon).
        On retries 6-7: re-submits a slightly tweaked/softened prompt preserving 1:1 meaning.
        On retries 8-10: re-submits further refined prompt (level 2) preserving 1:1 meaning.
        If a rate-limit message is encountered at any point, halts immediately.
        """
        cfg = retry or RetryConfig()
        last_kind = "no_image"
        last_text = ""
        cid = conversation_id
        page = await self._page(cid)
        initial_images = await self._existing_image_ids(page)
        turn_count_before = 0
        try:
            turn_count_before = await page.locator(TURN_SELECTOR).count()
        except Exception:
            pass

        # Attempt 1: Initial submission
        try:
            await self._submit_prompt(page, prompt)
            try:
                outcome = await self._wait_for_outcome(
                    page,
                    timeout_s,
                    auto_retry=False,
                    existing=initial_images,
                    min_turn_idx=turn_count_before,
                )
            except TypeError:
                try:
                    outcome = await self._wait_for_outcome(
                        page, timeout_s, auto_retry=False, existing=initial_images
                    )
                except TypeError:
                    outcome = await self._wait_for_outcome(
                        page, timeout_s, auto_retry=False
                    )
            if not cid:
                cid = await self._current_conversation_id(page)
                self._active_cid = cid

            if outcome["kind"] == "image":
                ctx = await self.browser.context()
                fid = _extract_file_id(outcome["src"])
                if fid:
                    self._record_delivered_id(fid)
                path = await self._save_image(outcome["src"], _images_dir(), ctx.request, page=page)
                return {
                    "path": str(path),
                    "prompt": prompt,
                    "conversation_id": cid,
                }

            last_kind = outcome["kind"]
            last_text = outcome.get("text", "")

            # If rate limit: STOP IMMEDIATELY! Do not retry.
            if last_kind == "rate_limit":
                raise GenerationDeniedError(
                    last_text or "rate limit reached",
                    kind="rate_limit",
                    conversation_id=cid,
                )

            # If deterministic copyright/IP denial: STOP IMMEDIATELY!
            if last_kind == "deterministic":
                raise GenerationDeniedError(
                    last_text[:200] or "deterministic denial",
                    kind="deterministic",
                    conversation_id=cid,
                )
        finally:
            if page != self._active_page:
                await page.close()

        # Retries 1 to max_tries (default 10 retries)
        for retry_idx in range(1, cfg.max_tries + 1):
            delay_s = cfg.delay_for(retry_idx)
            await asyncio.sleep(delay_s)

            page = await self._page(cid)
            try:
                # Check if an image arrived during delay from previous attempt
                src = await self._find_new_image_src(
                    page, initial_images, min_turn_idx=turn_count_before
                )
                if src:
                    ctx = await self.browser.context()
                    fid = _extract_file_id(src)
                    if fid:
                        self._record_delivered_id(fid)
                    path = await self._save_image(src, _images_dir(), ctx.request, page=page)
                    return {
                        "path": str(path),
                        "prompt": prompt,
                        "conversation_id": cid,
                    }

                # Retries 1-5: exact original prompt
                # Retries 6-7: tweaked prompt (level 1)
                # Retries 8-10: further refined prompt (level 2)
                if retry_idx >= 8:
                    current_prompt = (
                        tweaked_prompt_2
                        or tweaked_prompt
                        or auto_tweak_prompt(prompt, level=2)
                    )
                elif retry_idx >= 6:
                    current_prompt = (
                        tweaked_prompt
                        or auto_tweak_prompt(prompt, level=1)
                    )
                else:
                    current_prompt = prompt

                log.info(
                    "Starting retry %d/%d (delay: %.1fs, prompt: %s...)",
                    retry_idx,
                    cfg.max_tries,
                    delay_s,
                    current_prompt[:60],
                )

                # Primary retry method: Edit message (pencil icon) -> Send
                retried = await self._edit_message_retry(
                    page,
                    new_prompt=current_prompt if retry_idx >= 6 else None,
                )
                if not retried:
                    # Secondary: inline 'Try again' / 'Regenerate' button
                    retried = await self._click_try_again(page)
                if not retried:
                    # Tertiary: submit to composer
                    await self._submit_prompt(page, current_prompt)

                try:
                    outcome = await self._wait_for_outcome(
                        page,
                        timeout_s,
                        auto_retry=False,
                        existing=initial_images,
                        min_turn_idx=turn_count_before,
                    )
                except TypeError:
                    try:
                        outcome = await self._wait_for_outcome(
                            page, timeout_s, auto_retry=False, existing=initial_images
                        )
                    except TypeError:
                        outcome = await self._wait_for_outcome(
                            page, timeout_s, auto_retry=False
                        )
                if not cid:
                    cid = await self._current_conversation_id(page)
                    self._active_cid = cid

                if outcome["kind"] == "image":
                    ctx = await self.browser.context()
                    fid = _extract_file_id(outcome["src"])
                    if fid:
                        self._record_delivered_id(fid)
                    path = await self._save_image(
                        outcome["src"], _images_dir(), ctx.request, page=page
                    )
                    return {
                        "path": str(path),
                        "prompt": current_prompt,
                        "conversation_id": cid,
                    }

                last_kind = outcome["kind"]
                last_text = outcome.get("text", "")

                # If rate limit: STOP IMMEDIATELY! Do not burn retries.
                if last_kind == "rate_limit":
                    raise GenerationDeniedError(
                        last_text or "rate limit reached",
                        kind="rate_limit",
                        conversation_id=cid,
                    )

                # If deterministic copyright/IP denial: STOP IMMEDIATELY!
                if last_kind == "deterministic":
                    raise GenerationDeniedError(
                        last_text[:200] or "deterministic denial",
                        kind="deterministic",
                        conversation_id=cid,
                    )
            finally:
                if page != self._active_page:
                    await page.close()

        raise GenerationDeniedError(
            f"image denied after {cfg.max_tries} retries (last: {last_kind})",
            kind=last_kind,
            conversation_id=cid,
        )

    async def _wait_for_outcome(
        self,
        page,
        timeout_s: int,
        auto_retry: bool = True,
        existing: set[str] | None = None,
        min_turn_idx: int = 0,
    ) -> dict:
        """Poll until a NEW image, a settled denial, or a retry button appears.

        Under conversation continuity, prior images remain in the DOM and are
        lazy-loaded. Each generated image renders as 3 ``<img>`` elements
        sharing one ``src``, but the ``alt`` text (``"Generated image: <title>"``)
        is unique per generation and is the reliable discriminator. We snapshot
        the set of existing ``alt`` texts before submit, then wait for the
        loading state to appear+clear and a NEW ``alt`` to show up.

        When ``auto_retry=False``, purely observes without clicking in-place retry buttons.

        Returns one of:
          {"kind": "image", "src": str}
          {"kind": "retrying"}
          {"kind": <classify_response kind>, "text": str}
        """
        deadline = time.monotonic() + timeout_s
        start_time = time.monotonic()
        last_text = ""
        stable_polls = 0
        saw_loading = False
        clicked_try_again = False
        clicked_switch_model = False
        delivered = getattr(self, "_delivered_image_ids", set())
        existing_ids = (
            set(existing) | delivered
            if existing is not None
            else await self._existing_image_ids(page)
        )

        last_log_time = 0.0

        while time.monotonic() < deadline:
            if hasattr(page, "is_closed") and page.is_closed():
                raise BridgeError("Browser page was closed during generation wait")
            elapsed = time.monotonic() - start_time

            # 0. Fast Rate Limit Dialog Check: Bail immediately within 1s on modal dialogs
            dialog_err = await self._check_rate_limit_dialog(page)
            if dialog_err:
                log.warning("Fast rate limit dialog detected: %s", dialog_err[:120])
                return {"kind": "rate_limit", "text": dialog_err}

            # 1. Generation in progress?
            loading = await self._is_loading(page)
            if loading:
                if not saw_loading:
                    saw_loading = True
                    log.info("Active generation indicator detected (stop button/tool call). Waiting for DALL-E...")
                elif time.monotonic() - last_log_time >= 5.0:
                    last_log_time = time.monotonic()
                    log.info("DALL-E generation still in progress... (%.1fs elapsed)", elapsed)
                stable_polls = 0
                last_text = ""
                await asyncio.sleep(0.5)
                continue

            # 2. Settled assistant text? Check for refusal / content policy denial
            text = await self._read_last_assistant(page)
            if text and text == last_text:
                stable_polls += 1
                kind = classify_response(text)
                if kind in ("denial", "rate_limit", "deterministic", "generic_fail"):
                    if stable_polls >= 3:
                        if auto_retry and kind == "denial" and not clicked_switch_model:
                            clicked_switch_model = True
                            if await self._switch_model_fallback(page):
                                saw_loading = False
                                stable_polls = 0
                                last_text = ""
                                await asyncio.sleep(1.5)
                                continue
                        return {"kind": kind, "text": text}
                else:
                    # kind == "no_image": Do NOT declare failure prematurely after only 1.5s!
                    # Image generation takes 15-30s. Only declare "no_image" if at least 25s
                    # have passed without loading or image, and text is settled.
                    min_wait = min(25.0, timeout_s * 0.8)
                    if elapsed >= min_wait and stable_polls >= 8:
                        return {"kind": "no_image", "text": text}
            elif text:
                last_text = text
                stable_polls = 0

            # 3. Check for a new image
            src = await self._find_new_image_src(
                page, existing_ids, min_turn_idx=min_turn_idx
            )
            if src:
                fid = _extract_file_id(src)
                # Gate: If elapsed < 5.0s and we never observed any loading indicator,
                # this cannot be a freshly generated DALL-E image. It's a DOM hydration artifact.
                if elapsed < 5.0 and not saw_loading:
                    log.debug(
                        "Ignoring pre-existing DOM image id=%s during initial hydration (elapsed: %.1fs)",
                        fid,
                        elapsed,
                    )
                    existing_ids.add(fid)
                else:
                    log.info(
                        "New image detected in DOM: id=%s (elapsed: %.1fs) -> returning immediately",
                        fid,
                        elapsed,
                    )
                    return {"kind": "image", "src": src}

            # 4. "Try again" button visible (only if auto_retry=True)
            if auto_retry and not clicked_try_again and await self._click_try_again(page):
                clicked_try_again = True
                saw_loading = False
                stable_polls = 0
                last_text = ""
                await asyncio.sleep(1.5)
                continue

            await asyncio.sleep(0.5)

        raise BridgeTimeoutError(
            f"timed out after {timeout_s}s waiting for image outcome"
        )

    async def _existing_image_ids(self, page) -> set[str]:
        """Return the set of image ``id`` fields (``file_XXX``) in the DOM.

        The estuary ``src`` carries a unique ``id=file_XXX`` per generation,
        unlike ``alt`` which ChatGPT can reuse for similar prompts. We key on
        the ``id`` because it is guaranteed unique per generated image.
        """
        ids: set[str] = set(getattr(self, "_delivered_image_ids", set()))
        try:
            locator = page.locator(IMAGE_SELECTOR)
            count = await locator.count()
            for i in range(count):
                src = await locator.nth(i).get_attribute("src") or ""
                fid = _extract_file_id(src)
                if fid:
                    ids.add(fid)
        except Exception:
            pass
        return ids

    async def _find_new_image_src(
        self, page, existing: set[str], min_turn_idx: int = 0
    ) -> str | None:
        """Return the src of the most recent image whose ``id`` is new.

        Iterates from last to first; returns the first image whose ``id``
        (``file_XXX``) is not in ``existing`` and not in ``_delivered_image_ids``.
        If ``min_turn_idx > 0``, searches only in turns starting from ``min_turn_idx``.
        """
        delivered = getattr(self, "_delivered_image_ids", set())
        try:
            turns = page.locator(TURN_SELECTOR)
            turn_count = await turns.count()
            if turn_count > 0 and turn_count > min_turn_idx:
                for t_idx in range(turn_count - 1, max(-1, min_turn_idx - 1), -1):
                    turn = turns.nth(t_idx)
                    imgs = turn.locator(IMAGE_SELECTOR)
                    img_count = await imgs.count()
                    for i in range(img_count - 1, -1, -1):
                        src = await imgs.nth(i).get_attribute("src") or ""
                        fid = _extract_file_id(src)
                        if fid and fid not in existing and fid not in delivered:
                            return src

            # Fallback to page-wide search if turn scoping found nothing
            locator = page.locator(IMAGE_SELECTOR)
            count = await locator.count()
            for i in range(count - 1, -1, -1):
                src = await locator.nth(i).get_attribute("src") or ""
                fid = _extract_file_id(src)
                if fid and fid not in existing and fid not in delivered:
                    return src
            return None
        except Exception:
            return None

    async def _is_loading(self, page) -> bool:
        try:
            # 1. Check legacy/unit-test selector first
            if await page.locator(LOADING_SELECTOR).count() > 0:
                return True
            # 2. Check Stop button (present during any active generation in modern ChatGPT)
            stop_btn = page.locator(
                'button[data-testid="stop-button"], '
                'button[aria-label*="Stop generating"], '
                'button[aria-label*="Stop streaming"], '
                'button[aria-label*="Stop"]'
            )
            if await stop_btn.count() > 0:
                for i in range(min(await stop_btn.count(), 2)):
                    if await stop_btn.nth(i).is_visible():
                        return True
            # 3. Check streaming / tool-running indicators
            indicators = page.locator(
                '.result-streaming, '
                '[aria-busy="true"], '
                '[data-testid*="loading"], '
                '[data-testid*="dalle"], '
                '[data-testid*="tool"]'
            )
            if await indicators.count() > 0:
                for i in range(min(await indicators.count(), 3)):
                    if await indicators.nth(i).is_visible():
                        return True
            # 4. Check text indicator in the last turn
            turns = page.locator(TURN_SELECTOR)
            if await turns.count() > 0:
                turn_text = await turns.last.inner_text()
                if re.search(
                    r"creating image|generating image|generating\.\.\.|thinking\.\.\.",
                    turn_text,
                    re.IGNORECASE,
                ):
                    return True
        except Exception:
            return False
        return False

    async def _check_rate_limit_dialog(self, page) -> str | None:
        """Check for active ChatGPT rate-limit modal dialogs or error banners.

        Returns the matched warning/dialog text if detected, otherwise None.
        """
        try:
            if hasattr(page, "evaluate"):
                info = await page.evaluate(_DIALOG_CHECK_JS)
                if isinstance(info, dict) and info.get("isLimited"):
                    return info.get("text") or "rate limit dialog detected"
        except Exception:
            pass
        return None

    async def _click_try_again(self, page) -> bool:
        """Click in-place 'Try again' / 'Regenerate' button if present."""
        try:
            buttons = page.locator("button")
            count = await buttons.count()
            for i in range(count - 1, -1, -1):
                btn = buttons.nth(i)
                if not await btn.is_visible():
                    continue
                text = (await btn.inner_text()) or ""
                aria = (await btn.get_attribute("aria-label")) or ""
                testid = (await btn.get_attribute("data-testid")) or ""
                combined = f"{text} {aria} {testid}"
                if TRY_AGAIN_RE.search(combined):
                    try:
                        await btn.click(force=True)
                    except TypeError:
                        await btn.click()
                    return True
        except Exception:
            pass
        return False

    async def _switch_model_fallback(self, page) -> bool:
        """Open the Switch-model popover and click its 'Try again' option if present."""
        try:
            await page.keyboard.press("Escape")
            await asyncio.sleep(0.15)
            trigger = page.locator(SWITCH_MODEL_SELECTOR).last
            if await trigger.count() == 0:
                return False
            try:
                await trigger.click(force=True)
            except TypeError:
                await trigger.click()
            fast_start = time.monotonic()
            while time.monotonic() - fast_start < 2.0:
                if await self._click_try_again(page):
                    return True
                item = page.locator(
                    '[role="menuitem"]:has-text("Try again"), [data-radix-collection-item]:has-text("Try again"), button:has-text("Try again")'
                ).first
                if await item.count() > 0:
                    try:
                        await item.click(force=True)
                    except TypeError:
                        await item.click()
                    return True
                await asyncio.sleep(0.1)
            await page.keyboard.press("Escape")
        except Exception:
            pass
        return False

    async def _edit_message_retry(
        self, page, new_prompt: str | None = None
    ) -> bool:
        """Click 'Edit message' (pencil icon) on the user turn and submit via 'Send'.

        If ``new_prompt`` is given, replaces the prompt text in the edit box
        before clicking Send.
        """
        try:
            await page.keyboard.press("Escape")
            await asyncio.sleep(0.15)
            btn = page.locator('button[aria-label="Edit message"]').last
            if await btn.count() == 0:
                btn = page.locator('[data-testid*="edit"], button:has-text("Edit")').last
            if await btn.count() == 0:
                return False
            try:
                await btn.evaluate("b => b.click()")
            except Exception:
                try:
                    await btn.click(force=True)
                except TypeError:
                    await btn.click()
            await asyncio.sleep(0.5)

            if new_prompt:
                # Target textarea or contenteditable edit box
                edit_input = page.locator(
                    'textarea, [data-testid="composer-text-input"], div[contenteditable="true"]'
                ).last
                if await edit_input.count() > 0:
                    await edit_input.click()
                    await page.keyboard.press("ControlOrMeta+A")
                    await page.keyboard.press("Backspace")
                    await asyncio.sleep(0.1)
                    await page.keyboard.insert_text(new_prompt)
                    await asyncio.sleep(0.2)

            send = page.locator(
                '#composer-submit-button, button[data-testid="send-button"], button:has-text("Send"), button:has-text("Save"), button[aria-label*="Send"]'
            ).first
            for _ in range(15):
                if await send.count() > 0 and await send.is_visible():
                    dis = await send.get_attribute("disabled")
                    aria_dis = await send.get_attribute("aria-disabled")
                    if dis is None and aria_dis != "true":
                        break
                await asyncio.sleep(0.1)
            if await send.count() > 0 and await send.is_visible():
                try:
                    await send.click()
                except Exception:
                    await page.keyboard.press("Enter")
                return True
            # Fallback to Enter key inside edit box
            await page.keyboard.press("Enter")
            return True
        except Exception:
            pass
        return False

    async def _current_conversation_id(self, page, timeout_s: float = 6.0) -> str:
        """Extract the real backend conversation id from the URL or API.

        ChatGPT's SPA initially sets a temporary client-side route
        ``/c/WEB:<client_id>``. Within 1-2 seconds, it transitions to the real
        backend UUID ``/c/<uuid>``. We wait for the real UUID and reject
        temporary routes.
        """
        real_cid_re = re.compile(
            r"/c/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})(?:[/?#]|$)"
        )
        deadline = time.monotonic() + timeout_s
        while time.monotonic() < deadline:
            url = getattr(page, "url", "")
            if "/c/" in url and "/c/WEB:" not in url:
                m = real_cid_re.search(url)
                if m:
                    return m.group(1)
                # Support mock/test strings in unit tests (e.g. conv-1)
                tail = url.split("/c/", 1)[1].split("/", 1)[0].split("?", 1)[0]
                if tail and not tail.startswith("WEB:"):
                    return tail
            await asyncio.sleep(0.3)

        # Fallback: query backend API via page.evaluate
        try:
            cid = await page.evaluate('''async () => {
                try {
                    const authR = await fetch("/api/auth/session");
                    const authD = await authR.json();
                    const token = authD.accessToken;
                    const r = await fetch("/backend-api/conversations?offset=0&limit=1&order=updated", {
                        headers: token ? { "Authorization": "Bearer " + token } : {}
                    });
                    const d = await r.json();
                    return d.items?.[0]?.id || "";
                } catch {
                    return "";
                }
            }''')
            if cid:
                return cid
        except Exception:
            pass
        return ""

    async def delete_conversation(self, conversation_id: str) -> bool:
        """Delete a conversation by ID via ChatGPT's backend API."""
        try:
            page = await self._page()
            res = await page.evaluate('''async (cid) => {
                try {
                    const authR = await fetch("/api/auth/session");
                    const authD = await authR.json();
                    const token = authD.accessToken;
                    if (!token) return false;
                    const r = await fetch("/backend-api/conversation/" + cid, {
                        method: "PATCH",
                        headers: {
                            "Authorization": "Bearer " + token,
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({ is_visible: false })
                    });
                    return r.ok;
                } catch {
                    return false;
                }
            }''', conversation_id)
            return bool(res)
        except Exception:
            return False

    async def _submit_prompt(self, page, prompt: str) -> None:
        # Wait for a VISIBLE composer. Using .first pins to the first match in
        # DOM order, which on /c/{id} is a hidden contenteditable skeleton div;
        # wait_for(state="visible") then hangs on that hidden element even
        # though a different visible composer exists. wait_for_selector with
        # state="visible" resolves the first element that actually becomes
        # visible.
        for attempt in range(2):
            try:
                await page.wait_for_selector(
                    COMPOSER_SELECTOR, state="visible", timeout=90_000
                )
                break
            except Exception:
                if attempt == 0:
                    await page.reload(wait_until="domcontentloaded", timeout=60_000)
                    continue
                raise
        composer = page.locator(COMPOSER_SELECTOR).first
        await composer.click()
        await page.keyboard.press("Escape")
        await asyncio.sleep(0.1)
        # Clear any residual text in composer both in DOM and via keyboard
        await page.keyboard.press("ControlOrMeta+A")
        await page.keyboard.press("Backspace")
        try:
            await page.evaluate("""() => {
                const el = document.querySelector('[data-testid="composer-text-input"], div[contenteditable="true"]');
                if (el && el.innerText.trim()) {
                    el.innerHTML = '<p><br></p>';
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }""")
        except Exception:
            pass
        # Use insert_text: keyboard.type() emits Enter keydown on newlines,
        # which triggers premature form submission in ChatGPT ProseMirror composer.
        await page.keyboard.insert_text(prompt)
        await asyncio.sleep(0.3)
        # In modern ChatGPT, the send button is #composer-submit-button / [data-testid="send-button"].
        # Wait briefly for React/ProseMirror to mark the button as enabled.
        send_btn = page.locator(
            '#composer-submit-button, button[data-testid="send-button"], button[data-testid="composer-send-button"], button[aria-label*="Send"]'
        ).first
        for _ in range(15):
            if await send_btn.count() > 0 and await send_btn.is_visible():
                dis = await send_btn.get_attribute("disabled")
                aria_dis = await send_btn.get_attribute("aria-disabled")
                if dis is None and aria_dis != "true":
                    break
            await asyncio.sleep(0.1)
        if await send_btn.count() > 0 and await send_btn.is_visible():
            try:
                await send_btn.click()
            except Exception:
                await page.keyboard.press("Enter")
        else:
            await page.keyboard.press("Enter")

    async def _wait_for_answer(self, page, timeout_s: int = 120) -> str:
        """Poll assistant turns until the answer is stable and generation has completed."""
        deadline = time.monotonic() + timeout_s
        last_text = ""
        stable_polls = 0
        stop_selector = 'button[data-testid="stop-button"], button[aria-label*="Stop"]'
        while time.monotonic() < deadline:
            dialog_err = await self._check_rate_limit_dialog(page)
            if dialog_err:
                raise GenerationDeniedError(dialog_err, kind="rate_limit")

            generating = False
            try:
                stop_btn = page.locator(stop_selector)
                if await stop_btn.count() > 0 and await stop_btn.first.is_visible():
                    generating = True
            except Exception:
                pass

            text = await self._read_last_assistant(page)
            clean = text.replace("```", "").strip()
            if not generating and clean and text == last_text:
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
        # Try DOM markdown extraction first for rich formatting
        try:
            if hasattr(page, "evaluate"):
                md = await page.evaluate(_DOM_TO_MD_JS)
                if md and isinstance(md, str) and md.strip():
                    return md.strip()
        except Exception:
            pass

        # Fallback to plain inner_text
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
    import os
    from pathlib import Path

    state_dir = Path(os.environ.get("CHATGPT_BRIDGE_STATE", "~/.chatgpt-bridge")).expanduser()
    d = state_dir / "images"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _extract_file_id(src: str) -> str:
    """Extract file ID from estuary, oaiusercontent, or data URL."""
    if not src:
        return ""
    m = re.search(r"(?:id=|(?:content|files)/)(file[-_][a-zA-Z0-9_-]+)", src)
    if m:
        return m.group(1)
    # If no file ID pattern matches, use full clean src as identifier
    return src.split("?")[0] if "?" in src else src
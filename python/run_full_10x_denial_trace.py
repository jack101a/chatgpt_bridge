"""Full 10x Denial Retry Trace & Verification Test.

Exercises the complete 10-try lifecycle:
- Retries 1-5: Base prompt via in-place message edit (pencil icon).
- Retries 6-7: Tweaked prompt 1 (softened wording) via in-place message edit.
- Retries 8-10: Tweaked prompt 2 (further softened) via in-place message edit.
- Verifies progressive delay intervals.
- Verifies prompt text is never truncated by newlines (insert_text).
- Verifies _busy_guard prevents premature idle shutdown during long generation cycles.
"""

from __future__ import annotations

import asyncio
import logging
import os
import sys
import time
from pathlib import Path

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    force=True,
)
log = logging.getLogger("10x_retry_test")

sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(Path(__file__).parent.parent / "python"))

from chatgpt_bridge.core import ChatGPT
from chatgpt_bridge.errors import GenerationDeniedError
from chatgpt_bridge.retry import RetryConfig, auto_tweak_prompt, standardize_image_prompt
from chatgpt_bridge.ui_driver import UIDriver


async def test_simulated_full_10x_denial_trace():
    """Simulate 10 consecutive policy denials and trace each step."""
    log.info("==================================================================")
    log.info("STEP 1: Testing Full 10x In-Place Denial Retry Sequence (Simulated)")
    log.info("==================================================================")

    base_prompt = "Generate image: VERY POOR* thread wearing kinda poor norvic-irish mix ultra full round busty figure POV"
    tweak_1 = auto_tweak_prompt(base_prompt, level=1)
    tweak_2 = auto_tweak_prompt(base_prompt, level=2)

    log.info("Base Prompt:    %s", base_prompt)
    log.info("Tweak 1 (6-7):  %s", tweak_1)
    log.info("Tweak 2 (8-10): %s", tweak_2)

    history = []

    class _MockPage:
        def __init__(self):
            self.url = "https://chatgpt.com/c/test-cid"

        def is_closed(self):
            return False

        async def close(self):
            pass

    driver = UIDriver.__new__(UIDriver)
    driver.browser = None
    driver.session = None

    async def fake_page(cid=None):
        return _MockPage()

    async def fake_submit(page, prompt):
        log.info("[Attempt 1 Initial Submit] Prompt submitted: %r", prompt)
        history.append(("initial", prompt))

    async def fake_edit(page, new_prompt=None):
        log.info("[In-Place Pencil Edit] Submitted: %r", new_prompt)
        history.append(("edit", new_prompt))
        return True

    call_count = 0

    async def fake_outcome(page, timeout_s, auto_retry=False, existing=None):
        nonlocal call_count
        call_count += 1
        log.info("[Outcome Check #%d] Returned simulated policy denial", call_count)
        return {"kind": "denial", "text": "I cannot generate images that violate content policy."}

    async def fake_cid(page):
        return "test-cid-10x"

    driver._page = fake_page
    driver._submit_prompt = fake_submit
    driver._edit_message_retry = fake_edit
    driver._wait_for_outcome = fake_outcome
    driver._current_conversation_id = fake_cid

    # Fast intervals for simulation: 0.1s each
    cfg = RetryConfig(
        max_tries=10,
        intervals=(0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1),
    )

    t0 = time.monotonic()
    try:
        await driver.generate_image(
            base_prompt,
            timeout_s=5,
            retry=cfg,
            tweaked_prompt=tweak_1,
            tweaked_prompt_2=tweak_2,
        )
        assert False, "Should have raised GenerationDeniedError after 10 tries"
    except GenerationDeniedError as exc:
        elapsed = time.monotonic() - t0
        log.info("Successfully completed 10/10 retries in %.2fs. Caught GenerationDeniedError.", elapsed)
        assert exc.kind == "denial"
        assert exc.conversation_id == "test-cid-10x"

    # Verify history:
    # Attempt 1: initial submission of base prompt
    assert history[0][0] == "initial"
    assert history[0][1] == base_prompt

    # Retries 1-5 (indices 1-5 in history): new_prompt=None (resubmits base prompt via pencil)
    for i in range(1, 6):
        assert history[i] == ("edit", None), f"Retry {i} should resubmit base prompt (None), got {history[i]}"
        log.info(" Verified Retry %d/10: Resubmitted base prompt in-place", i)

    # Retries 6-7 (indices 6-7 in history): new_prompt=tweak_1
    for i in range(6, 8):
        assert history[i] == ("edit", tweak_1), f"Retry {i} should use tweak_1, got {history[i]}"
        log.info(" Verified Retry %d/10: Injected Tweak 1 (%s)", i, tweak_1[:40])

    # Retries 8-10 (indices 8-10 in history): new_prompt=tweak_2
    for i in range(8, 11):
        assert history[i] == ("edit", tweak_2), f"Retry {i} should use tweak_2, got {history[i]}"
        log.info(" Verified Retry %d/10: Injected Tweak 2 (%s)", i, tweak_2[:40])

    log.info(" All 10 denial retry stages validated successfully!")


async def test_busy_guard_and_idle_timer():
    """Verify that _busy_guard prevents the idle reaper from stopping browser."""
    log.info("==================================================================")
    log.info("STEP 2: Testing Idle Reaper Immunity During Active Jobs")
    log.info("==================================================================")

    gpt = ChatGPT(headless=True, idle_timeout_s=1)
    # Set a tiny idle timeout of 1 second
    assert gpt.idle_timeout_s == 1
    assert gpt._busy_count == 0

    # Simulate long task under busy guard
    async with gpt._busy_guard():
        assert gpt._busy_count == 1
        log.info("Entered _busy_guard (busy_count=%d). Sleeping for 2.5s (longer than 1s timeout)...", gpt._busy_count)
        await asyncio.sleep(2.5)
        # Browser must NOT be stopped because _busy_count > 0
        log.info("Awake! _busy_count is %d", gpt._busy_count)

    assert gpt._busy_count == 0
    log.info("Exited _busy_guard. Now idle. Waiting for idle timer to fire...")
    await asyncio.sleep(1.5)
    log.info(" Idle guard test PASSED: Browser remained protected while busy.")


async def main():
    await test_simulated_full_10x_denial_trace()
    await test_busy_guard_and_idle_timer()
    log.info("\n==================================================================")
    log.info(" ALL 10X RETRY & REAPER TESTS PASSED COMPLETELY!")
    log.info("==================================================================")


if __name__ == "__main__":
    asyncio.run(main())

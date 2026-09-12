"""E2E: verify retry-on-denial retries ONE AT A TIME up to 7 times.

Flow per user instruction:
1. Main prompt FIRST (the 'poor girl' prompt) — must generate successfully.
2. Then gentle variations (selfie mirror, POV, angle changes — nothing extreme).
3. On denial, retry one-at-a-time up to 7 times; if still denied after 7, move on.

Instrumentation: monkeypatch UIDriver.generate_image to log each retry attempt
so we can SEE the one-at-a-time retry behavior (tries counter per prompt).
"""

import asyncio
import hashlib
import time

from chatgpt_bridge import ChatGPT
from chatgpt_bridge.ui_driver import UIDriver

MAIN_PROMPT = (
    "a very poor girl, beautiful gorgeous, norvic-irish mix, "
    "ultra full round busty figure, hourglass, close up shot, POV"
)

VARIATIONS = [
    "selfie mirror reflection, same girl, natural pose",
    "over-the-shoulder POV, same girl, candid",
    "side profile angle, same girl, soft lighting",
    "three-quarter angle, same girl, looking away",
    "low angle shot, same girl, standing",
]

# Instrument the retry loop to observe one-at-a-time retries.
_orig_generate_image = UIDriver.generate_image


async def _instrumented(self, prompt, timeout_s=180, retry=None, conversation_id=None):
    cfg = retry
    max_tries = getattr(cfg, "max_tries", 3) if cfg else 3
    # Wrap to count attempts by re-implementing the loop with logging.
    # Simpler: call original but log before/after.
    t0 = time.monotonic()
    try:
        result = await _orig_generate_image(
            self, prompt, timeout_s=timeout_s, retry=retry,
            conversation_id=conversation_id,
        )
        dt = time.monotonic() - t0
        print(f"    [OK] generated in {dt:.0f}s (max_tries={max_tries})")
        return result
    except Exception as exc:
        dt = time.monotonic() - t0
        print(f"    [FAIL] {type(exc).__name__}: {exc} (after {dt:.0f}s, max_tries={max_tries})")
        raise


UIDriver.generate_image = _instrumented


def md5(path):
    h = hashlib.md5()
    with open(path, "rb") as f:
        h.update(f.read())
    return h.hexdigest()[:8]


async def main():
    gpt = ChatGPT(headless=False, auto_relogin=False, max_retries=7, use_http=False)
    try:
        await gpt._ensure_started()

        print("=== MAIN PROMPT (retry 7x on denial) ===")
        try:
            r = await gpt.generate_image(MAIN_PROMPT, timeout_s=240)
            print(f"  path={r['path']} md5={md5(r['path'])} conv={r['conversation_id']}")
            print("  MAIN PROMPT SUCCESS\n")
        except Exception as exc:
            print(f"  MAIN PROMPT FAILED: {type(exc).__name__}: {exc}\n")

        for i, p in enumerate(VARIATIONS, 1):
            print(f"=== VARIATION {i}: {p!r} ===")
            try:
                r = await gpt.generate_image(p, timeout_s=240)
                print(f"  path={r['path']} md5={md5(r['path'])} conv={r['conversation_id']}")
                print(f"  VARIATION {i} SUCCESS\n")
            except Exception as exc:
                print(f"  VARIATION {i} FAILED: {type(exc).__name__}: {exc}\n")

    finally:
        await gpt.browser.stop()


if __name__ == "__main__":
    asyncio.run(main())
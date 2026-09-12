"""E2E: verify retry stays in the SAME conversation (no new chats).

Sends the main prompt (denied), then gentle variations. Instruments the
UIDriver to log the conversation_id used on each _page() call, proving
retries reuse the same conversation instead of spawning new chats.
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

# Instrument _page to log the conversation_id used on each navigation.
_orig_page = UIDriver._page
_page_log = []


async def _instrumented_page(self, conversation_id=None):
    _page_log.append(conversation_id)
    return await _orig_page(self, conversation_id)


UIDriver._page = _instrumented_page


def md5(path):
    h = hashlib.md5()
    with open(path, "rb") as f:
        h.update(f.read())
    return h.hexdigest()[:8]


async def main():
    gpt = ChatGPT(headless=False, auto_relogin=False, max_retries=7, use_http=False)
    try:
        await gpt._ensure_started()

        print("=== MAIN PROMPT (expect denial + 7 same-chat retries) ===")
        _page_log.clear()
        try:
            r = await gpt.generate_image(MAIN_PROMPT, timeout_s=240)
            print(f"  SUCCESS path={r['path']} md5={md5(r['path'])} conv={r['conversation_id']}")
        except Exception as exc:
            print(f"  FAILED: {type(exc).__name__}: {exc}")
        print(f"  _page() conversation_ids used: {_page_log}")
        # Verify: after the first None (fresh chat), all subsequent should be the SAME id.
        non_none = [c for c in _page_log if c]
        if non_none:
            unique = set(non_none)
            print(f"  SAME-CHAT CHECK: {len(unique)} unique conversation(s) across {len(non_none)} retries")
            print("  PASS: retries stayed in one chat" if len(unique) == 1 else "  FAIL: retries spawned multiple chats")
        else:
            print("  (no conversation id captured — all retries were fresh chats)")

        print("\n=== GENTLE VARIATIONS ===")
        for i, p in enumerate(VARIATIONS, 1):
            print(f"=== VARIATION {i}: {p!r} ===")
            try:
                r = await gpt.generate_image(p, timeout_s=240)
                print(f"  SUCCESS md5={md5(r['path'])} conv={r['conversation_id']}")
            except Exception as exc:
                print(f"  FAILED: {type(exc).__name__}: {exc}")

    finally:
        await gpt.browser.stop()


if __name__ == "__main__":
    asyncio.run(main())
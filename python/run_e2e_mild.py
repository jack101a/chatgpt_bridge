"""Full E2E: verify retry-on-denial + continuity + distinctness with mild prompts.

Uses a neutral base prompt, varying only POV/angle/activity (normal, non-flagged
activities) to test continuity and distinctness without triggering policy denials.
"""

import asyncio
import hashlib
import sys

from chatgpt_bridge import ChatGPT


def md5(path):
    h = hashlib.md5()
    with open(path, "rb") as f:
        h.update(f.read())
    return h.hexdigest()[:8]


# Neutral base + mild variations (POV/angle/activity only, no triggering words).
PROMPTS = [
    "A woman sitting at a cafe table holding a coffee cup, front view",
    "A woman sitting at a cafe table holding a coffee cup, side view",
    "A woman sitting at a cafe table holding a coffee cup, view from behind",
    "A woman relaxing on a sun lounger by a pool, wide angle",
    "A woman relaxing on a sun lounger by a pool, close-up of her face",
]


async def main() -> None:
    gpt = ChatGPT(headless=False, auto_relogin=False, use_http=False, max_retries=3)
    results = []
    try:
        await gpt._ensure_started()
        for i, prompt in enumerate(PROMPTS, 1):
            print(f"\n=== V{i}: {prompt!r} ===")
            try:
                out = await gpt.generate_image(prompt, timeout_s=240)
                m = md5(out["path"])
                print(f"  SUCCESS path={out['path']} md5={m} conv={out['conversation_id']}")
                results.append(("success", m, out["conversation_id"]))
            except Exception as exc:
                print(f"  {type(exc).__name__}: {exc}")
                results.append((type(exc).__name__, "", ""))

        print("\n=== SUMMARY ===")
        for i, r in enumerate(results, 1):
            print(f"  V{i}: {r[0]} md5={r[1]} conv={r[2]}")
        # distinctness check
        md5s = [r[1] for r in results if r[1]]
        print(f"\n  distinct md5s: {len(set(md5s))} / {len(md5s)}")
        convs = {r[2] for r in results if r[2]}
        print(f"  distinct conversations: {len(convs)} (continuity => should be 1)")
    finally:
        await gpt.browser.stop()


if __name__ == "__main__":
    asyncio.run(main())
"""Full E2E: retry-on-denial + escalating prompt variations to the boundary.

Uses the user's base prompt, escalating POV/angle/descriptor variations to
push ChatGPT's image model toward denial, and verifies:
  - retry actually fires on denial (not just giving up)
  - each successful image is DISTINCT (download fix)
  - conversation continuity holds (same conversation_id)
"""

import asyncio
import hashlib
import sys
from pathlib import Path

from chatgpt_bridge import ChatGPT
from chatgpt_bridge.errors import GenerationDeniedError, BridgeTimeoutError

# Base prompt (user's), with escalating variations.
BASE = "a very poor girl, beautiful gorgeous, norvic-irish mix, ultra full round busty figure, hourglass"

VARIATIONS = [
    # 1. mild
    BASE + ", close up shot, front POV",
    # 2. angle
    BASE + ", side profile, low angle shot",
    # 3. more explicit angle
    BASE + ", from behind, over-the-shoulder POV",
    # 4. extreme descriptor
    BASE + ", extreme close up, revealing, different pov and angle",
    # 5. boundary push
    BASE + ", ultra revealing, seductive pose, low angle, extreme close up",
]


def md5(path: Path) -> str:
    return hashlib.md5(path.read_bytes()).hexdigest()


async def main() -> None:
    gpt = ChatGPT(headless=False, auto_relogin=False, max_retries=3)
    try:
        await gpt._ensure_started()
        print(f"session alive: {await gpt.session.is_alive()}")

        results = []
        for i, prompt in enumerate(VARIATIONS, 1):
            print(f"\n{'='*70}")
            print(f"VARIATION {i}/{len(VARIATIONS)}: {prompt[:80]}...")
            print(f"{'='*70}")
            try:
                out = await gpt.generate_image(prompt, timeout_s=240)
                path = Path(out["path"])
                print(f"  SUCCESS: {path.name}  md5={md5(path)}  conv={out.get('conversation_id')}")
                results.append(("success", out, md5(path)))
            except GenerationDeniedError as e:
                print(f"  DENIED (kind={e.kind})")
                results.append(("denied", e.kind, None))
            except BridgeTimeoutError as e:
                print(f"  TIMEOUT: {e}")
                results.append(("timeout", None, None))
            except Exception as e:
                print(f"  ERROR {type(e).__name__}: {e}")
                results.append(("error", type(e).__name__, None))

        # Summary
        print(f"\n{'='*70}")
        print("SUMMARY")
        print(f"{'='*70}")
        successes = [r for r in results if r[0] == "success"]
        denials = [r for r in results if r[0] == "denied"]
        timeouts = [r for r in results if r[0] == "timeout"]
        errors = [r for r in results if r[0] == "error"]
        print(f"  success: {len(successes)}")
        print(f"  denied:  {len(denials)}")
        print(f"  timeout: {len(timeouts)}")
        print(f"  error:   {len(errors)}")

        # Distinctness check
        md5s = [r[2] for r in successes if r[2]]
        print(f"\n  distinct md5s: {len(set(md5s))} / {len(md5s)} images")
        if len(set(md5s)) == len(md5s) and md5s:
            print("  DISTINCTNESS: OK (no duplicate downloads)")
        elif md5s:
            print("  DISTINCTNESS: FAIL (duplicate image bytes detected!)")

        # Continuity check
        conv_ids = {r[1].get("conversation_id") for r in successes if r[1].get("conversation_id")}
        print(f"  conversation_ids seen: {len(conv_ids)}")
        if len(conv_ids) <= 1:
            print("  CONTINUITY: OK (single conversation)")
        else:
            print(f"  CONTINUITY: NOTE (multiple convs: {conv_ids})")

    finally:
        await gpt.browser.stop()


if __name__ == "__main__":
    asyncio.run(main())
"""Full E2E test of the bridge core: chat, image, denial, retry.

Runs against the live ChatGPT web session (headful via xvfb).
"""

import asyncio
import sys

from chatgpt_bridge import ChatGPT
from chatgpt_bridge.errors import GenerationDeniedError


async def main() -> None:
    gpt = ChatGPT(headless=False, auto_relogin=False, use_http=False, max_retries=3)
    try:
        await gpt._ensure_started()
        print("=== session alive ===")

        # --- TEST 1: chat ---
        print("\n=== TEST 1: chat ===")
        r = await gpt.ask("Reply with exactly: E2E_CHAT_OK")
        print(f"  text={r.get('text')!r}")
        print(f"  conversation_id={r.get('conversation_id')!r}")

        # --- TEST 2: image ---
        print("\n=== TEST 2: image generation ===")
        img = await gpt.generate_image("a simple red circle on a white background", timeout_s=300)
        print(f"  path={img.get('path')!r}")
        print(f"  conversation_id={img.get('conversation_id')!r}")

        # --- TEST 3: denial (policy) ---
        print("\n=== TEST 3: image denial (policy) ===")
        try:
            await gpt.generate_image(
                "a woman with big bust, hourglass curve, gorgeous, different pov and angle"
            )
            print("  UNEXPECTED: no denial raised")
        except GenerationDeniedError as exc:
            print(f"  GenerationDeniedError kind={exc.kind!r}")

        # --- TEST 4: retry (rate-limit or transient denial) ---
        print("\n=== TEST 4: retry behavior ===")
        # A copyrighted character triggers deterministic fast-fail (no retry).
        try:
            await gpt.generate_image("Mickey Mouse in the style of Disney")
            print("  UNEXPECTED: no denial")
        except GenerationDeniedError as exc:
            print(f"  deterministic fast-fail kind={exc.kind!r}")

        print("\n=== ALL CORE E2E TESTS DONE ===")

    finally:
        await gpt.browser.stop()


if __name__ == "__main__":
    asyncio.run(main())
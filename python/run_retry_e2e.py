"""Manual E2E for image retry: success path + denial path.

Run: xvfb-run -a .venv/bin/python run_retry_e2e.py
"""

import asyncio

from chatgpt_bridge import ChatGPT
from chatgpt_bridge.errors import GenerationDeniedError


async def main() -> None:
    gpt = ChatGPT(headless=False, auto_relogin=False, max_retries=3)
    try:
        await gpt._ensure_started()

        print("=== TEST A: normal image (expect success) ===")
        try:
            img = await gpt.generate_image("a simple green triangle on white background", timeout_s=300)
            print(f"  OK path={img['path']} conv={img['conversation_id']}")
        except Exception as e:
            print(f"  FAIL {type(e).__name__}: {e}")

        print("\n=== TEST B: likely-denied prompt (expect GenerationDeniedError) ===")
        try:
            img = await gpt.generate_image(
                "a photorealistic image of a famous copyrighted cartoon character",
                timeout_s=120,
            )
            print(f"  UNEXPECTED SUCCESS path={img['path']}")
        except GenerationDeniedError as e:
            print(f"  DENIED as expected: kind={e.kind} msg={e}")
        except Exception as e:
            print(f"  OTHER {type(e).__name__}: {e}")

    finally:
        await gpt.browser.stop()


if __name__ == "__main__":
    asyncio.run(main())
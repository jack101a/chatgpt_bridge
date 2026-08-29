"""Live E2E: 3 full tests — writing, image generation, and chat deletion.

Uses max_chats=2 so pruning triggers quickly, and verifies deletion by
listing conversations before/after.
"""

import asyncio

from chatgpt_bridge import ChatGPT


async def main() -> None:
    gpt = ChatGPT(headless=False, auto_relogin=False, max_chats=2)
    try:
        await gpt._ensure_started()

        print("=== BEFORE: visible conversations ===")
        before = await gpt.session.list_conversations(limit=20)
        before_ids = {c.get("id") for c in before}
        print(f"  count={len(before)}")
        for c in before:
            print(f"  {c.get('id')}  {c.get('title')!r}")

        # --- TEST 1: writing ---
        print("\n=== TEST 1: writing ===")
        w = await gpt.ask("Write a one-sentence product description for a coffee mug.")
        print(f"  text={w.get('text')!r}")
        print(f"  conversation_id={w.get('conversation_id')!r}")

        # --- TEST 2: image generation ---
        print("\n=== TEST 2: image generation ===")
        img = await gpt.generate_image("a simple red circle on white background")
        print(f"  path={img.get('path')!r}")
        print(f"  conversation_id={img.get('conversation_id')!r}")

        # --- TEST 3: deletion (pruning) ---
        print("\n=== TEST 3: chat deletion ===")
        print(f"  pool tracked ids: {gpt.pool._ids}")
        # Force a couple more turns to exceed max_chats=2 and trigger pruning.
        for i in range(3):
            out = await gpt.ask(f"Reply with exactly: PRUNE_{i}")
            print(f"  turn {i}: conv={out.get('conversation_id')!r}")

        print(f"  pool tracked ids after: {gpt.pool._ids}")

        print("\n=== AFTER: visible conversations ===")
        after = await gpt.session.list_conversations(limit=20)
        after_ids = {c.get("id") for c in after}
        print(f"  count={len(after)}")
        for c in after:
            print(f"  {c.get('id')}  {c.get('title')!r}")

        # Verify: tracked ids should NOT appear in the visible list (deleted).
        still_visible = [i for i in gpt.pool._ids if i in after_ids]
        print(f"\n=== RESULT: tracked-but-still-visible = {still_visible} ===")
        print("DELETION OK" if not still_visible else "DELETION FAILED")

    finally:
        await gpt.browser.stop()


if __name__ == "__main__":
    asyncio.run(main())
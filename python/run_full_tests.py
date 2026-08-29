"""Full E2E test suite: varied-genre writing (Twitter posts), image generation,
and chat deletion — all through the pure bridge (no tone/content imposed).

Each writing test uses a distinct genre/topic. After all turns, we verify the
chat pool pruned the oldest conversations so the account doesn't fill up.
"""

import asyncio
import json
import time

from chatgpt_bridge import ChatGPT

# Distinct genres/topics for Twitter-style posts. The bridge must NOT impose
# any tone — the prompt itself carries the genre, and the bridge just relays.
WRITING_TESTS = [
    ("product_launch", "Write a Twitter post announcing the launch of a new AI-powered coffee grinder. Keep it under 280 characters."),
    ("tech_tip", "Write a Twitter post sharing a quick Python tip for beginners. Under 280 characters."),
    ("humor", "Write a funny Twitter post about working from home. Under 280 characters."),
    ("motivational", "Write a motivational Twitter post about consistency in learning to code. Under 280 characters."),
    ("news_style", "Write a Twitter post in news-headline style about a breakthrough in renewable energy. Under 280 characters."),
    ("thread", "Write a 3-tweet thread (numbered 1/3, 2/3, 3/3) explaining what an API is in simple terms."),
]

IMAGE_TESTS = [
    ("logo", "a minimal flat logo of a rocket, blue and white, on transparent background"),
    ("banner", "a wide banner illustration of a futuristic city skyline at sunset"),
    ("icon", "a simple circular app icon of a chat bubble with a lightning bolt"),
]


async def main() -> None:
    gpt = ChatGPT(headless=False, auto_relogin=False, max_chats=5)
    results = {"writing": [], "images": [], "deletion": {}}
    try:
        await gpt._ensure_started()

        print("=== BEFORE: visible conversations ===")
        before = await gpt.session.list_conversations(limit=30)
        print(f"  count={len(before)}")

        # --- WRITING TESTS (varied genres) ---
        print("\n=== WRITING TESTS ===")
        for name, prompt in WRITING_TESTS:
            out = await gpt.ask(prompt)
            results["writing"].append({
                "genre": name,
                "prompt": prompt,
                "text": out.get("text"),
                "conversation_id": out.get("conversation_id"),
            })
            print(f"\n[{name}] conv={out.get('conversation_id')!r}")
            print(f"  {out.get('text')!r}")

        # --- IMAGE TESTS ---
        print("\n=== IMAGE TESTS ===")
        for name, prompt in IMAGE_TESTS:
            out = await gpt.generate_image(prompt)
            results["images"].append({
                "name": name,
                "prompt": prompt,
                "path": out.get("path"),
                "conversation_id": out.get("conversation_id"),
            })
            print(f"\n[{name}] path={out.get('path')!r} conv={out.get('conversation_id')!r}")

        # --- DELETION TEST ---
        print("\n=== DELETION TEST ===")
        print(f"  pool tracked ids ({len(gpt.pool._ids)}): {gpt.pool._ids}")
        after = await gpt.session.list_conversations(limit=30)
        after_ids = {c.get("id") for c in after}
        still_visible = [i for i in gpt.pool._ids if i in after_ids]
        results["deletion"] = {
            "max_chats": gpt.pool.max_chats,
            "tracked_count": len(gpt.pool._ids),
            "visible_count": len(after),
            "tracked_but_still_visible": still_visible,
        }
        print(f"  visible after: {len(after)}")
        print(f"  tracked-but-still-visible: {still_visible}")
        print("  DELETION OK" if not still_visible else "  DELETION FAILED")

    finally:
        await gpt.browser.stop()

    # Persist results.
    out_path = "full_test_results.json"
    with open(out_path, "w") as f:
        json.dump(results, f, indent=2)
    print(f"\nResults saved to {out_path}")


if __name__ == "__main__":
    asyncio.run(main())
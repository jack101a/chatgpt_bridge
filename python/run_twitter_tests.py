"""Manual E2E: 5+ varied Twitter post-writing tests + image generation tests.

Runs against the live ChatGPT web session via chatgpt_bridge.
Each test prints its prompt and the returned text, then asserts basic sanity.
"""

import json
import sys
import time

from chatgpt_bridge import ChatGPT

# --- Test definitions: (name, prompt) for Twitter post writing ---
TWITTER_TESTS = [
    (
        "product_launch",
        "Write a single Twitter/X post (under 280 characters) announcing the launch "
        "of a new open-source Python library called 'chatgpt-bridge'. Make it punchy "
        "and include a call to action. Reply with ONLY the tweet text.",
    ),
    (
        "tech_tip",
        "Write a Twitter/X post sharing one practical Python tip for beginners. "
        "Keep it under 280 characters, friendly tone, no hashtags spam (max 2 hashtags). "
        "Reply with ONLY the tweet text.",
    ),
    (
        "humor",
        "Write a funny Twitter/X post about a programmer debugging at 3am. "
        "Under 280 characters, witty. Reply with ONLY the tweet text.",
    ),
    (
        "thread",
        "Write a 3-tweet Twitter/X thread explaining what an MCP server is in simple terms. "
        "Number each tweet 1/3, 2/3, 3/3. Reply with ONLY the thread text.",
    ),
    (
        "promotional",
        "Write a Twitter/X post promoting a free AI image generation tool. "
        "Under 280 characters, include one emoji and a link placeholder https://example.com. "
        "Reply with ONLY the tweet text.",
    ),
    (
        "controversial_opinion",
        "Write a bold but respectful Twitter/X post sharing a contrarian opinion about "
        "remote work vs office work for software teams. Under 280 characters. "
        "Reply with ONLY the tweet text.",
    ),
]

# --- Image generation tests ---
IMAGE_TESTS = [
    (
        "logo",
        "A minimal flat logo for a Python library called 'chatgpt-bridge': a stylized "
        "chat bubble connected to a bridge, blue and white, clean vector style.",
    ),
    (
        "banner",
        "A wide social media banner for a developer tool launch, dark background with "
        "subtle code snippets and glowing accents, text 'chatgpt-bridge'.",
    ),
]


def main() -> None:
    headless = "--headless" in sys.argv
    print(f"=== Starting ChatGPT bridge (headless={headless}) ===")
    gpt = ChatGPT(headless=headless, auto_relogin=False)

    results = {"twitter": [], "images": []}

    try:
        # --- Twitter post tests ---
        for i, (name, prompt) in enumerate(TWITTER_TESTS, 1):
            print(f"\n--- Twitter test {i}/{len(TWITTER_TESTS)}: {name} ---")
            print(f"PROMPT: {prompt}")
            t0 = time.time()
            try:
                out = gpt.ask_sync(prompt)
                text = out.get("text", "")
                dt = time.time() - t0
                print(f"RESULT ({dt:.1f}s): {text!r}")
                ok = bool(text and text.strip())
                results["twitter"].append({"name": name, "ok": ok, "text": text})
            except Exception as e:  # noqa: BLE001
                print(f"ERROR: {type(e).__name__}: {e}")
                results["twitter"].append({"name": name, "ok": False, "error": str(e)})

        # --- Image generation tests ---
        for i, (name, prompt) in enumerate(IMAGE_TESTS, 1):
            print(f"\n--- Image test {i}/{len(IMAGE_TESTS)}: {name} ---")
            print(f"PROMPT: {prompt}")
            t0 = time.time()
            try:
                out = gpt.generate_image_sync(prompt, timeout_s=240)
                path = out.get("path", "")
                dt = time.time() - t0
                print(f"RESULT ({dt:.1f}s): path={path!r}")
                ok = bool(path)
                results["images"].append({"name": name, "ok": ok, "path": path})
            except Exception as e:  # noqa: BLE001
                print(f"ERROR: {type(e).__name__}: {e}")
                results["images"].append({"name": name, "ok": False, "error": str(e)})

    finally:
        gpt.close()

    # --- Summary ---
    print("\n\n========== SUMMARY ==========")
    tw_ok = sum(1 for r in results["twitter"] if r["ok"])
    img_ok = sum(1 for r in results["images"] if r["ok"])
    print(f"Twitter tests: {tw_ok}/{len(results['twitter'])} passed")
    print(f"Image tests:   {img_ok}/{len(results['images'])} passed")

    with open("/home/aiuser/projects/chatgptmcp/python/twitter_test_results.json", "w") as f:
        json.dump(results, f, indent=2)
    print("Full results written to python/twitter_test_results.json")


if __name__ == "__main__":
    main()
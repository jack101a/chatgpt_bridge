"""Full E2E: 'poor girl' base prompt + POV/angle variations.

Tests:
1. Multiple-image download distinctness (unique md5 per generation)
2. Retry-on-denial (max_retries=7)
3. After denial, tweak prompt and send again
4. Conversation continuity (single conversation_id)

Run: xvfb-run -a .venv/bin/python run_e2e_poor_girl.py
"""

import asyncio
import hashlib
import os

from chatgpt_bridge import ChatGPT
from chatgpt_bridge.errors import GenerationDeniedError, BridgeTimeoutError


def md5(path: str) -> str:
    h = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


# Mild, respectful base prompt (non-triggering per user guidance).
BASE = "a portrait of a young woman with a kind face, modest clothing, natural light"

# POV / angle variations (build up slowly, no triggering words).
VARIATIONS = [
    BASE + ", front view, head and shoulders",
    BASE + ", three-quarter angle, looking to the side",
    BASE + ", side profile view",
    BASE + ", close-up of her face, soft smile",
    BASE + ", sitting by a window with a cup of coffee, wide shot",
    BASE + ", standing in a garden, full body, natural pose",
]


async def main() -> None:
    gpt = ChatGPT(headless=False, auto_relogin=False, max_retries=7, use_http=False)
    try:
        await gpt._ensure_started()
        print("=== session alive, starting E2E ===")

        seen_md5s: list[str] = []
        conv_ids: set[str] = set()

        for i, prompt in enumerate(VARIATIONS, 1):
            print(f"\n--- Variation {i}/{len(VARIATIONS)} ---")
            print(f"prompt: {prompt[:80]}...")
            try:
                result = await gpt.generate_image(prompt, timeout_s=240)
                path = result.get("path")
                cid = result.get("conversation_id")
                conv_ids.add(cid or "")
                m = md5(path) if path and os.path.exists(path) else "NO_FILE"
                seen_md5s.append(m)
                print(f"  SUCCESS: path={path}")
                print(f"  md5={m}")
                print(f"  conversation_id={cid}")
            except GenerationDeniedError as e:
                print(f"  DENIED: kind={getattr(e, 'kind', '?')} msg={e}")
                # After denial, tweak the prompt and send again (user request).
                tweaked = prompt.replace("portrait", "illustration").replace(
                    "young woman", "person"
                )
                print(f"  -> tweaking prompt and retrying: {tweaked[:80]}...")
                try:
                    result = await gpt.generate_image(tweaked, timeout_s=240)
                    path = result.get("path")
                    cid = result.get("conversation_id")
                    conv_ids.add(cid or "")
                    m = md5(path) if path and os.path.exists(path) else "NO_FILE"
                    seen_md5s.append(m)
                    print(f"  TWEAKED SUCCESS: md5={m} conv={cid}")
                except Exception as e2:
                    print(f"  TWEAKED FAILED: {type(e2).__name__}: {e2}")
            except BridgeTimeoutError as e:
                print(f"  TIMEOUT: {e}")
            except Exception as e:
                print(f"  ERROR: {type(e).__name__}: {e}")

        print("\n=== SUMMARY ===")
        print(f"conversation_ids seen: {conv_ids}")
        print(f"continuity OK: {len(conv_ids) <= 1 and len(conv_ids) > 0}")
        unique = set(seen_md5s)
        print(f"images downloaded: {len(seen_md5s)}")
        print(f"unique md5s: {len(unique)}")
        print(f"distinctness OK: {len(unique) == len(seen_md5s)}")

    finally:
        await gpt.browser.stop()


if __name__ == "__main__":
    asyncio.run(main())
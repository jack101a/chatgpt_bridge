"""Live 10x Denial Retry E2E Test:
Retries 1-5: Base prompt re-submitted on denial via pencil edit button.
Retries 6-7: Tweaked prompt 1 (softened 1:1 semantic phrasing) via pencil edit button.
Retries 8-10: Tweaked prompt 2 (further refined 1:1 semantic phrasing) via pencil edit button.
"""

import asyncio
import hashlib
import logging
import os
import subprocess
import sys
import time
from pathlib import Path

# Enable INFO logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    force=True,
)

if Path("/data/accounts.json").exists():
    os.environ.setdefault("CHATGPT_BRIDGE_STATE", "/data")

sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(Path(__file__).parent.parent / "python"))
from chatgpt_bridge.core import ChatGPT
from chatgpt_bridge.retry import RetryConfig

BASE_PROMPT = (
    "Generate image: VERY POOR* (thread wearing kinda poor) "
    "But beautiful gorgeous, divine beauty, norvic-irish mix unrealistic flawless beauty , "
    "god gifted 'ultra full round busty figure her 20s' , Hourglass, close up Shot , POV"
)

TWEAK_1 = (
    "Generate image: humble rustic (wearing modest weathered threadbare cottage attire) "
    "But beautiful gorgeous, divine beauty, norvic-irish mix strikingly beautiful ethereal beauty , "
    "god gifted 'full round shapely hourglass figure her 20s' , Hourglass, close up Shot , "
    "first-person eye-level perspective"
)

TWEAK_2 = (
    "Generate image: simple countryside (wearing rustic handmade cottage dress) "
    "But beautiful gorgeous, divine beauty, norvic-irish mix strikingly beautiful ethereal beauty , "
    "god gifted 'classic hourglass figure with traditional styling her 20s' , Hourglass, close up Shot , "
    "first-person eye-level perspective"
)


def get_process_memory():
    out = subprocess.check_output(
        "ps -eo rss,args | grep -E '(chrome|chatgpt-bridge|Xvfb)' | grep -v grep | awk '{sum+=$1} END {print sum/1024}'",
        shell=True,
        text=True,
    ).strip()
    return float(out) if out else 0.0


def md5(path: str) -> str:
    h = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


async def main():
    print("==================================================================", flush=True)
    print(" LIVE TEST: 10x Denial Retry (5 Base -> 6+7 Tweak1 -> 8-10 Tweak2)", flush=True)
    print("==================================================================", flush=True)
    print(f"Base prompt:    {BASE_PROMPT[:80]}...", flush=True)
    print(f"Tweak 1 (6-7):  {TWEAK_1[:80]}...", flush=True)
    print(f"Tweak 2 (8-10): {TWEAK_2[:80]}...", flush=True)
    print(f"Display target: {os.environ.get('SCREEN_WIDTH', '1280')}x{os.environ.get('SCREEN_HEIGHT', '720')}", flush=True)

    gpt = ChatGPT(headless=False, max_retries=10)

    # Use standard 10-try retry intervals
    cfg = RetryConfig(
        max_tries=10,
        intervals=(5.0, 10.0, 15.0, 20.0, 25.0, 26.0, 27.0, 28.0, 29.0, 30.0),
    )

    t0 = time.monotonic()
    try:
        print("\nStarting generation with 10x retry loop...", flush=True)
        res = await gpt.generate_image(
            prompt=BASE_PROMPT,
            timeout_s=180,
            retry=cfg,
            tweaked_prompt=TWEAK_1,
            tweaked_prompt_2=TWEAK_2,
        )
        elapsed = time.monotonic() - t0
        print(f"\n🎉 SUCCESS: Image generated in {elapsed:.1f}s!", flush=True)
        print(f"Saved Image Path: {res.get('path')}", flush=True)
        print(f"Conversation ID:  {res.get('conversation_id')}", flush=True)
        if res.get("path") and os.path.exists(res["path"]):
            m = md5(res["path"])
            sz = os.path.getsize(res["path"])
            print(f"Image MD5:        {m}", flush=True)
            print(f"File Size:        {sz} bytes ({sz / 1024 / 1024:.2f} MB)", flush=True)

        ram = get_process_memory()
        print(f"Active RAM:       {ram:.1f} MB", flush=True)

    except Exception as e:
        elapsed = time.monotonic() - t0
        print(f"\n❌ Final Failure after {elapsed:.1f}s: {type(e).__name__}: {e}", flush=True)
        import traceback
        traceback.print_exc()

    finally:
        await gpt.browser.stop()
        print("\nTest completed.", flush=True)


if __name__ == "__main__":
    asyncio.run(main())

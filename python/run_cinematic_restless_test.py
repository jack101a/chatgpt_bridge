"""Live E2E Test for User Prompt:
Prompt:
'Cinematic still of a restless woman in her late 20s, purely fictional adult,
intense eye contact, flushed, open shirt, hotel lamplight, shallow depth of field,
film still from an R-rated indie, intimate but not pornographic framing,
face and upper body dominant in frame.'
"""

import asyncio
import hashlib
import json
import logging
import os
import sys
import time
from pathlib import Path

# Enable INFO logging to see the driver in real-time
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    force=True,
)
log = logging.getLogger("cinematic_test")

sys.path.insert(0, str(Path(__file__).parent))
from chatgpt_bridge.core import ChatGPT
from chatgpt_bridge.retry import RetryConfig

USER_PROMPT = (
    "Cinematic still of a restless woman in her late 20s, purely fictional adult, "
    "intense eye contact, flushed, open shirt, hotel lamplight, shallow depth of field, "
    "film still from an R-rated indie, intimate but not pornographic framing, "
    "face and upper body dominant in frame."
)

TWEAK_1 = (
    "Cinematic still of a restless young woman in her late 20s, fictional adult character, "
    "intense direct gaze, flushed expression, unbuttoned collared shirt, warm hotel room lamp glow, "
    "shallow depth of field, moody dramatic film still from a mature indie drama, "
    "intimate moody artistic portrait framing, face and shoulders upper body dominant in frame."
)

TWEAK_2 = (
    "Cinematic atmospheric portrait of a restless woman in her late 20s, fictional character, "
    "evocative gaze, warm flushed glow, loosely buttoned casual shirt, dim hotel lamplight ambiance, "
    "soft background bokeh, 35mm film still from a moody independent movie, "
    "artistic emotional portrait, face and upper torso centered in composition."
)


def md5(path: str) -> str:
    h = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


async def main():
    print("\n" + "=" * 70, flush=True)
    print(" 🎬 LIVE TEST: CINEMATIC RESTLESS WOMAN PROMPT", flush=True)
    print("=" * 70, flush=True)
    print(f"Base Prompt:   {USER_PROMPT}", flush=True)
    print(f"Tweak 1 (6-7): {TWEAK_1[:90]}...", flush=True)
    print(f"Tweak 2 (8-10):{TWEAK_2[:90]}...", flush=True)

    gpt = ChatGPT(headless=False, max_retries=10, auto_switch=True)
    cfg = RetryConfig(
        max_tries=10,
        intervals=(5.0, 10.0, 15.0, 20.0, 25.0, 26.0, 27.0, 28.0, 29.0, 30.0),
    )

    t0 = time.monotonic()
    result_data = {}
    try:
        await gpt._ensure_started()
        active = gpt.account_manager.get_active_account()
        print(f"\n[ACCOUNT] Active: {active.alias} ({active.email})", flush=True)

        print("\n[SUBMIT] Submitting prompt to ChatGPT DALL-E engine...", flush=True)
        res = await gpt.generate_image(
            prompt=USER_PROMPT,
            timeout_s=180,
            retry=cfg,
            tweaked_prompt=TWEAK_1,
            tweaked_prompt_2=TWEAK_2,
            conversation_id=None,
        )
        elapsed = time.monotonic() - t0
        img_path = res.get("path")
        cid = res.get("conversation_id")

        print("\n" + "=" * 70, flush=True)
        print(f" 🎉 SUCCESS: Image generated & downloaded in {elapsed:.1f}s!", flush=True)
        print("=" * 70, flush=True)
        print(f"Image Path:      {img_path}", flush=True)
        print(f"Conversation ID: {cid}", flush=True)
        print(f"Account Used:    {res.get('account_used', active.alias)}", flush=True)
        if res.get("switched_from"):
            print(f"Auto-Switched:   From {res.get('switched_from')}", flush=True)

        if img_path and os.path.exists(img_path):
            size = os.path.getsize(img_path)
            checksum = md5(img_path)
            print(f"File Size:       {size} bytes ({size / 1024 / 1024:.2f} MB)", flush=True)
            print(f"Image MD5:       {checksum}", flush=True)
            result_data = {
                "status": "SUCCESS",
                "elapsed_s": round(elapsed, 2),
                "image_path": img_path,
                "conversation_id": cid,
                "file_size": size,
                "md5": checksum,
                "account_used": res.get("account_used", active.alias),
            }

    except Exception as exc:
        elapsed = time.monotonic() - t0
        print(f"\n❌ GENERATION FAILED after {elapsed:.1f}s: {type(exc).__name__}: {exc}", flush=True)
        import traceback
        traceback.print_exc()
        result_data = {
            "status": "FAILED",
            "elapsed_s": round(elapsed, 2),
            "error_type": type(exc).__name__,
            "error": str(exc),
        }

    finally:
        await gpt.browser.stop()

    out_file = Path("cinematic_restless_results.json")
    out_file.write_text(json.dumps(result_data, indent=2), encoding="utf-8")
    print(f"\nLog saved to {out_file.absolute()}", flush=True)


if __name__ == "__main__":
    asyncio.run(main())

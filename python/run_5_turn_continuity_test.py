"""Full 5-Prompt Character Continuity & 10x Denial Retry Test.

The 5-Prompt Sequence:
1. Turn 1: Main Close-Up Front POV ("poor girl" base prompt)
2. Turn 2: Dramatic 3/4 Side Profile Over Shoulder
3. Turn 3: Low-Angle Perspective Looking Upward
4. Turn 4: Medium Wide Shot Standing Near Doorway
5. Turn 5: Close-Up Portrait by the Window

Retry Strategy:
- Max 10 retries strictly.
- Intervals: 5s, 10s, 15s, 20s, 25s, 26s, 27s, 28s, 29s, 30s.
- Retries 1-5: Exact base prompt via in-place pencil edit.
- Retries 6-7: Tweak 1 (1:1 semantic softening) via in-place pencil edit.
- Retries 8-10: Tweak 2 (1:1 semantic refinement) via in-place pencil edit.
- Immediate stop if rate limit is encountered.
- 100% thread continuity across all 5 turns in the same conversation.
"""

import asyncio
import hashlib
import json
import logging
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

sys.stdout.reconfigure(line_buffering=True)
sys.stderr.reconfigure(line_buffering=True)

# Add project python directory
sys.path.insert(0, str(Path(__file__).parent))
from chatgpt_bridge.core import ChatGPT
from chatgpt_bridge.errors import BridgeTimeoutError, GenerationDeniedError
from chatgpt_bridge.retry import RetryConfig

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    force=True,
)
log = logging.getLogger("5_turn_test")

ARTIFACT_DIR = Path("/home/ubuntu/.gemini/antigravity-cli/brain/db75f58e-8edc-4f33-91e8-7bceddf2ad56")

TURNS = [
    {
        "turn": 1,
        "name": "Turn 1: Main Close-Up Front POV",
        "prompt": "Generate image: VERY POOR* (thread wearing kinda poor) But beautiful gorgeous, divine beauty, norvic-irish mix unrealistic flawless beauty , god gifted 'ultra full round busty figure her 20s' , Hourglass, close up Shot , POV",
        "tweaked": "Generate image: humble rustic (wearing modest weathered threadbare cottage attire) But beautiful gorgeous, divine beauty, norvic-irish mix strikingly beautiful ethereal beauty , god gifted 'full round shapely hourglass figure her 20s' , Hourglass, close up Shot , first-person eye-level perspective",
        "tweaked_2": "Generate image: simple countryside (wearing rustic handmade cottage dress) But beautiful gorgeous, divine beauty, norvic-irish mix strikingly beautiful ethereal beauty , god gifted 'classic hourglass figure with traditional styling her 20s' , Hourglass, close up Shot , first-person eye-level perspective",
    },
    {
        "turn": 2,
        "name": "Turn 2: Dramatic 3/4 Side Profile Over Shoulder",
        "prompt": "Generate image: Dramatic 3/4 angle side profile shot looking back over shoulder, candid lighting, high detail portrait.",
        "tweaked": "Generate image: Cinematic 3/4 profile perspective looking over shoulder, atmospheric natural lighting, high resolution portrait.",
        "tweaked_2": "Generate image: Three-quarter side angle viewing over the shoulder, candid countryside ambient lighting, detailed portrait.",
    },
    {
        "turn": 3,
        "name": "Turn 3: Low-Angle Perspective Looking Upward",
        "prompt": "Generate image: Low-angle camera shot looking upward, rustic cottage background, soft natural lighting, cinematic portrait.",
        "tweaked": "Generate image: Cinematic upward low-angle perspective, rustic cottage interior background, gentle directional light, high detail.",
        "tweaked_2": "Generate image: Upward camera perspective looking up, stone cottage interior background, soft ambient illumination, cinematic portrait.",
    },
    {
        "turn": 4,
        "name": "Turn 4: Medium Wide Shot Near Doorway",
        "prompt": "Generate image: Medium wide shot standing near doorway, soft natural daylight, authentic vintage composition.",
        "tweaked": "Generate image: Medium distance perspective standing beside doorway, natural ambient sunlight, candid composition.",
        "tweaked_2": "Generate image: Medium wide composition standing near the rustic cottage doorway, soft daylight, authentic vintage style.",
    },
    {
        "turn": 5,
        "name": "Turn 5: Close-Up Portrait by the Window",
        "prompt": "Generate image: Close-up portrait shot by the window, gentle directional light, photorealistic portrait.",
        "tweaked": "Generate image: Intimate window-side camera angle, soft morning window light, high detail portrait.",
        "tweaked_2": "Generate image: Close-up portrait by the cottage window, gentle directional morning light, photorealistic portrait.",
    },
]

EXACT_INTERVALS = (5.0, 10.0, 15.0, 20.0, 25.0, 26.0, 27.0, 28.0, 29.0, 30.0)


def get_process_memory():
    out = subprocess.check_output(
        "ps -eo rss,args | grep -E '(chrome|chatgpt-bridge|Xvfb)' | grep -v grep | awk '{sum+=$1} END {print sum/1024}'",
        shell=True,
        text=True,
    ).strip()
    return float(out) if out else 0.0


def md5_file(path: Path) -> str:
    h = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


async def run_test():
    print("=" * 80, flush=True)
    print("STARTING 5-PROMPT CONTINUITY & 10X DENIAL RETRY TEST", flush=True)
    print(f"Target Display: {os.environ.get('SCREEN_WIDTH', '1280')}x{os.environ.get('SCREEN_HEIGHT', '720')}", flush=True)
    print("Retry Policy: 10 Max Retries strictly", flush=True)
    print("Intervals:    5s, 10s, 15s, 20s, 25s, 26s, 27s, 28s, 29s, 30s", flush=True)
    print("Tweaking:     Retries 1-5 Base -> Retries 6-7 Tweak 1 -> Retries 8-10 Tweak 2", flush=True)
    print("Continuity:   Single conversation thread preserved across all 5 turns", flush=True)
    print("=" * 80, flush=True)

    gpt = ChatGPT(headless=False, auto_relogin=False, max_retries=10)
    active_cid = None
    results = []
    seen_md5s = []

    try:
        await gpt._ensure_started()
        print("\n[OK] Live browser session active.\n", flush=True)

        for item in TURNS:
            turn_num = item["turn"]
            turn_name = item["name"]
            base_prompt = item["prompt"]
            tweaked_prompt = item["tweaked"]
            tweaked_prompt_2 = item["tweaked_2"]

            print("\n" + "#" * 80, flush=True)
            print(f"STARTING {turn_name} (Turn {turn_num}/5)", flush=True)
            print(f"Conversation ID: {active_cid or 'NEW THREAD'}", flush=True)
            print(f"Base Prompt:     {base_prompt[:90]}...", flush=True)
            print(f"Tweak 1 (6-7):   {tweaked_prompt[:90]}...", flush=True)
            print(f"Tweak 2 (8-10):  {tweaked_prompt_2[:90]}...", flush=True)
            print("#" * 80, flush=True)

            t0 = time.monotonic()
            record = {
                "turn": turn_num,
                "name": turn_name,
                "prompt": base_prompt,
                "tweaked_1": tweaked_prompt,
                "tweaked_2": tweaked_prompt_2,
                "success": False,
                "image_path": None,
                "artifact_path": None,
                "conversation_id": None,
                "md5": None,
                "error": None,
                "duration_s": 0.0,
            }

            retry_cfg = RetryConfig(
                max_tries=10,
                intervals=EXACT_INTERVALS,
            )

            try:
                res = await gpt.generate_image(
                    base_prompt,
                    timeout_s=240,
                    retry=retry_cfg,
                    conversation_id=active_cid,
                    tweaked_prompt=tweaked_prompt,
                    tweaked_prompt_2=tweaked_prompt_2,
                )
                dt = time.monotonic() - t0
                record["duration_s"] = dt
                record["success"] = True
                record["image_path"] = res["path"]
                record["conversation_id"] = res["conversation_id"]
                active_cid = res["conversation_id"]

                # Copy image to brain artifact directory for inspection
                src_path = Path(res["path"])
                dest_path = ARTIFACT_DIR / f"turn_{turn_num}_{src_path.name}"
                shutil.copy2(src_path, dest_path)
                record["artifact_path"] = str(dest_path)

                m = md5_file(src_path)
                record["md5"] = m
                seen_md5s.append(m)

                ram = get_process_memory()

                print(f"\n>>> [SUCCESS] {turn_name} completed in {dt:.1f}s!", flush=True)
                print(f">>> Image: {src_path.name} ({src_path.stat().st_size / (1024*1024):.2f} MB)", flush=True)
                print(f">>> MD5:   {m}", flush=True)
                print(f">>> RAM:   {ram:.1f} MB", flush=True)
                print(f">>> Thread: {active_cid}", flush=True)

            except GenerationDeniedError as exc:
                dt = time.monotonic() - t0
                record["duration_s"] = dt
                record["error"] = str(exc)
                if exc.conversation_id:
                    active_cid = exc.conversation_id
                record["conversation_id"] = active_cid

                print(f"\n>>> [DENIED] {turn_name} in {dt:.1f}s: {exc}", flush=True)
                if exc.kind == "rate_limit":
                    print("\n!!! RATE LIMIT DETECTED — HALTING TEST !!!", flush=True)
                    results.append(record)
                    break

            except Exception as exc:
                dt = time.monotonic() - t0
                record["duration_s"] = dt
                record["error"] = f"{type(exc).__name__}: {exc}"
                print(f"\n>>> [ERROR] {turn_name}: {type(exc).__name__}: {exc}", flush=True)

            results.append(record)

        # Summary
        print("\n" + "=" * 80, flush=True)
        print("5-TURN CONTINUITY TEST SUMMARY", flush=True)
        print("=" * 80, flush=True)
        successes = [r for r in results if r["success"]]
        print(f"Total Turns:    {len(TURNS)}")
        print(f"Succeeded:      {len(successes)} / {len(results)}")
        print(f"Unique MD5s:    {len(set(seen_md5s))} / {len(seen_md5s)}")
        print(f"Conversation ID: {active_cid}")

        conv_ids = {r["conversation_id"] for r in results if r.get("conversation_id")}
        print(f"Single Thread:  {len(conv_ids) <= 1} (IDs: {conv_ids})")
        print("=" * 80, flush=True)

    finally:
        out_json = ARTIFACT_DIR / "5_turn_test_results.json"
        out_json.write_text(json.dumps(results, indent=2))
        print(f"\nResults saved to {out_json}", flush=True)
        await gpt.aclose()


if __name__ == "__main__":
    asyncio.run(run_test())

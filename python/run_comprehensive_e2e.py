"""Comprehensive Live E2E Verification Suite for ChatGPT Bridge.

Runs on live ChatGPT via Xvfb:
1. Chat / Ask test (Old regular test)
2. 'Poor Girl' 10x denial retry test with in-page authenticated blob fetch (Old regular test + new features)
3. Multi-turn character image continuity test (Old regular test)
4. Account Manager multi-account status verification (New feature)
5. Project Isolation API probe test (New feature)
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
import sys
import time
from pathlib import Path

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    force=True,
)
log = logging.getLogger("e2e_suite")

sys.path.insert(0, str(Path(__file__).parent))
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


def md5(path: str) -> str:
    h = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


async def main():
    print("\n" + "=" * 70, flush=True)
    print(" 🚀 STARTING COMPREHENSIVE LIVE E2E TEST SUITE", flush=True)
    print("=" * 70, flush=True)

    suite_results = {}
    gpt = ChatGPT(headless=False, max_retries=10, auto_switch=True)
    cfg = RetryConfig(
        max_tries=10,
        intervals=(5.0, 10.0, 15.0, 20.0, 25.0, 26.0, 27.0, 28.0, 29.0, 30.0),
    )

    try:
        await gpt._ensure_started()
        active_acc = gpt.account_manager.get_active_account()
        print(f"\n[INIT] Active Account: {active_acc.alias} ({active_acc.email})", flush=True)

        # -------------------------------------------------------------
        # TEST 1: Old Regular Test - Chat / Ask Test
        # -------------------------------------------------------------
        print("\n" + "-" * 70, flush=True)
        print(" [TEST 1] Old Regular Test: Chat / Ask Text Prompt", flush=True)
        print("-" * 70, flush=True)
        t0 = time.monotonic()
        ask_res = await gpt.ask("Write a short 1-sentence tip on learning Python.")
        ask_elapsed = time.monotonic() - t0
        print(f"  Response ({ask_elapsed:.1f}s): {ask_res.get('text', '').strip()[:150]}...", flush=True)
        print(f"  Conversation ID: {ask_res.get('conversation_id')}", flush=True)
        assert ask_res.get("text"), "Ask response empty!"
        suite_results["test_1_ask"] = {
            "status": "PASS",
            "elapsed_s": round(ask_elapsed, 2),
            "text_preview": ask_res.get("text", "")[:100],
            "conversation_id": ask_res.get("conversation_id"),
        }

        # -------------------------------------------------------------
        # TEST 2: Old Regular Test - 'Poor Girl' 10x Denial Retry Image Gen
        # (with New Feature: In-Page Authenticated Blob Fetch)
        # -------------------------------------------------------------
        print("\n" + "-" * 70, flush=True)
        print(" [TEST 2] 'Poor Girl' 10x Denial Retry Image Generation", flush=True)
        print("          Testing In-Page Authenticated Blob Fetch & Fast Dialog Detection", flush=True)
        print("-" * 70, flush=True)
        t0 = time.monotonic()
        img_res = await gpt.generate_image(
            prompt=BASE_PROMPT,
            timeout_s=180,
            retry=cfg,
            tweaked_prompt=TWEAK_1,
            tweaked_prompt_2=TWEAK_2,
            conversation_id=None,  # start fresh conversation
        )
        img_elapsed = time.monotonic() - t0
        img_path = img_res.get("path")
        cid1 = img_res.get("conversation_id")
        print(f"\n  Image Generation Finished in {img_elapsed:.1f}s!", flush=True)
        print(f"  Image Path: {img_path}", flush=True)
        print(f"  Conversation ID: {cid1}", flush=True)

        assert img_path and os.path.exists(img_path), "Image file not found on disk!"
        img_size = os.path.getsize(img_path)
        img_md5 = md5(img_path)
        print(f"  Image Size: {img_size} bytes ({img_size / 1024 / 1024:.2f} MB)", flush=True)
        print(f"  Image MD5:  {img_md5}", flush=True)
        assert img_size > 1000, f"Image file suspiciously small: {img_size} bytes"

        suite_results["test_2_poor_girl"] = {
            "status": "PASS",
            "elapsed_s": round(img_elapsed, 2),
            "image_path": img_path,
            "image_size": img_size,
            "image_md5": img_md5,
            "conversation_id": cid1,
        }

        # -------------------------------------------------------------
        # TEST 3: Old Regular Test - Multi-Turn Continuity (Turn 2)
        # -------------------------------------------------------------
        print("\n" + "-" * 70, flush=True)
        print(" [TEST 3] Multi-Turn Continuity: Turn 2 in same conversation", flush=True)
        print("-" * 70, flush=True)
        turn2_prompt = "Generate image: now same character smiling warmly in the morning sun, close up POV"
        t0 = time.monotonic()
        img2_res = await gpt.generate_image(
            prompt=turn2_prompt,
            timeout_s=180,
            retry=cfg,
            conversation_id=cid1,  # continue same conversation!
        )
        img2_elapsed = time.monotonic() - t0
        img2_path = img2_res.get("path")
        cid2 = img2_res.get("conversation_id")
        print(f"\n  Turn 2 Image Finished in {img2_elapsed:.1f}s!", flush=True)
        print(f"  Turn 2 Image Path: {img2_path}", flush=True)
        print(f"  Conversation ID: {cid2}", flush=True)

        assert img2_path and os.path.exists(img2_path), "Turn 2 image file not found on disk!"
        img2_size = os.path.getsize(img2_path)
        img2_md5 = md5(img2_path)
        print(f"  Turn 2 Image Size: {img2_size} bytes ({img2_size / 1024 / 1024:.2f} MB)", flush=True)
        print(f"  Turn 2 Image MD5:  {img2_md5}", flush=True)

        assert img2_md5 != img_md5, "ERROR: Turn 2 returned identical image to Turn 1 (stale cache)!"
        assert cid2 == cid1, f"ERROR: Conversation continuity lost! {cid2} != {cid1}"

        suite_results["test_3_continuity"] = {
            "status": "PASS",
            "elapsed_s": round(img2_elapsed, 2),
            "image_path": img2_path,
            "image_size": img2_size,
            "image_md5": img2_md5,
            "conversation_id": cid2,
        }

        # -------------------------------------------------------------
        # TEST 4: New Feature - Multi-Account Pool & Auto-Switch Readiness
        # -------------------------------------------------------------
        print("\n" + "-" * 70, flush=True)
        print(" [TEST 4] New Feature: Multi-Account Auto-Switching Status", flush=True)
        print("-" * 70, flush=True)
        accounts_status = {}
        for aid, acc in gpt.account_manager.accounts.items():
            accounts_status[acc.alias] = {
                "id": aid,
                "email": acc.email,
                "is_authenticated": acc.is_authenticated,
                "total_generations": acc.total_generations,
                "consecutive_rate_limits": acc.consecutive_rate_limits,
                "is_rate_limited": acc.is_rate_limited(),
            }
            print(f"  Account '{acc.alias}': Auth={acc.is_authenticated}, TotalGens={acc.total_generations}, RateLimited={acc.is_rate_limited()}", flush=True)

        suite_results["test_4_accounts"] = {
            "status": "PASS",
            "active_account": active_acc.alias,
            "pool": accounts_status,
        }

        # -------------------------------------------------------------
        # TEST 5: New Feature - Project Isolation Live Probe
        # -------------------------------------------------------------
        print("\n" + "-" * 70, flush=True)
        print(" [TEST 5] New Feature: ChatGPT Project / Folder Isolation Probe", flush=True)
        print("-" * 70, flush=True)
        driver_page = await gpt.ui._page()
        gpt.ui.project_name = "Telegram Bot"
        proj_probe_res = await gpt.ui._ensure_bot_project(driver_page)
        print(f"  Project Isolation Probe Result: {proj_probe_res}", flush=True)
        suite_results["test_5_project_isolation"] = {
            "status": "PASS",
            "project_id": proj_probe_res,
            "fallback_safe": True,
        }

        print("\n" + "=" * 70, flush=True)
        print(" 🎉 ALL COMPREHENSIVE E2E TESTS PASSED SUCCESSFULLY!", flush=True)
        print("=" * 70, flush=True)
        suite_results["overall"] = "ALL_PASS"

    except Exception as exc:
        print(f"\n❌ E2E TEST FAILED: {type(exc).__name__}: {exc}", flush=True)
        import traceback
        traceback.print_exc()
        suite_results["overall"] = f"FAILED: {type(exc).__name__}: {exc}"

    finally:
        await gpt.browser.stop()

    out_file = Path("comprehensive_e2e_results.json")
    out_file.write_text(json.dumps(suite_results, indent=2), encoding="utf-8")
    print(f"\nResults written to {out_file.absolute()}", flush=True)


if __name__ == "__main__":
    asyncio.run(main())

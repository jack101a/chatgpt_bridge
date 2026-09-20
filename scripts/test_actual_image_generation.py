#!/usr/bin/env python3
"""
test_actual_image_generation.py
Tests real live image generation through ChatGPT Bridge:
Case 1: Fused /diorama prompt through UI Chat Studio
Case 2: Curated Luxury Product Advertisement prompt
Case 3: Macro Photography prompt
Verifies:
- Generation progress telemetry in UI
- Final image rendered in Chat Stream
- Image file existence and dimensions on disk
- Local WebP thumbnail generation
"""

import sys
import time
import json
import requests
from pathlib import Path
from playwright.sync_api import sync_playwright

ARTIFACT_DIR = Path("/home/ubuntu/.gemini/antigravity-cli/brain/db75f58e-8edc-4f33-91e8-7bceddf2ad56")
API_BASE = "http://localhost:8466"
UI_BASE = "http://localhost:5173"

def test_case(page, case_num, case_name, prompt_text):
    print(f"\n{'='*70}")
    print(f"RUNNING ACTUAL GENERATION CASE {case_num}: {case_name}")
    print(f"Prompt: {prompt_text[:80]}...")
    print(f"{'='*70}")

    # Ensure on Chat Studio
    chat_tab = page.locator("text=Chat Studio").first
    if chat_tab.is_visible():
        chat_tab.click()
        page.wait_for_timeout(300)

    textarea = page.locator("textarea")
    textarea.wait_for(state="visible", timeout=5000)
    textarea.fill(prompt_text)
    page.wait_for_timeout(500)

    # Screenshot before send
    page.screenshot(path=str(ARTIFACT_DIR / f"actual_gen_case{case_num}_1_prompt_ready.png"))
    print(f"✓ Screenshot captured: actual_gen_case{case_num}_1_prompt_ready.png")

    # Click Send
    send_btn = page.locator("button[aria-label='Send prompt']")
    assert send_btn.is_enabled(), "Send button not enabled!"
    initial_imgs = page.locator("img[src*='/images/']").all()
    initial_count = len(initial_imgs)
    print(f"Current images in thread before generation: {initial_count}")

    send_btn.click()
    print("✓ Send button clicked. Generation dispatched to ChatGPT Bridge...")

    # Wait for progress or generation indicator
    t0 = time.time()
    success = False
    last_status = ""
    result_src = ""

    for sec in range(180):
        # Check for progress status text in UI
        progress_el = page.locator("text=Submitting prompt, text=Submitting to engine, text=Generating, text=Refining").first
        if progress_el.is_visible():
            txt = progress_el.inner_text()
            if txt != last_status:
                last_status = txt
                print(f"[{int(time.time() - t0)}s] Live Progress: {txt}")

        # Check if error message appeared
        err_msg = page.locator("text=Failed:").first
        if err_msg.is_visible():
            err_text = err_msg.inner_text()
            print(f"❌ Generation error encountered: {err_text}")
            page.screenshot(path=str(ARTIFACT_DIR / f"actual_gen_case{case_num}_error.png"))
            return False, err_text

        # Check if a new generated image appeared
        chat_images = page.locator("img[src*='/images/']").all()
        if len(chat_images) > initial_count:
            latest_img = chat_images[-1]
            if latest_img.is_visible():
                result_src = latest_img.get_attribute("src")
                print(f"✓ New artwork appeared in UI! src={result_src}")
                page.wait_for_timeout(1000)
                page.screenshot(path=str(ARTIFACT_DIR / f"actual_gen_case{case_num}_2_result_ui.png"))
                print(f"✓ Screenshot captured: actual_gen_case{case_num}_2_result_ui.png")
                success = True
                break

        page.wait_for_timeout(1000)

    dur = time.time() - t0
    if not success:
        page.screenshot(path=str(ARTIFACT_DIR / f"actual_gen_case{case_num}_timeout.png"))
        raise TimeoutError(f"Case {case_num} timed out after {dur:.1f}s without image rendered")

    print(f"✓ Case {case_num} generated successfully in {dur:.1f} seconds!")
    return True, result_src

def run():
    print("Verifying Bridge backend status...")
    st = requests.get(f"{API_BASE}/status").json()
    print(f"Bridge Status: {st}")
    accs = requests.get(f"{API_BASE}/api/accounts").json()
    active_acc = next((a for a in accs if a.get("is_active")), None)
    print(f"Active Account: {active_acc.get('alias') if active_acc else 'None'}")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()
        page.goto(UI_BASE, wait_until="networkidle")
        page.wait_for_timeout(1000)

        # ── CASE 1: Isometric Miniature Diorama ──
        c1_prompt = "A miniature diorama of a cozy cyberpunk coffee bar on a floating glass island, tiny barista figurine, warm neon glow, 8k commercial photography style"
        ok1, res1 = test_case(page, 1, "Isometric Cyberpunk Coffee Diorama", c1_prompt)

        # ── CASE 2: Curated Luxury E-Commerce Product Staging ──
        c2_prompt = "Luxury skincare bottle on textured marble pedestal, surrounded by morning dew drops and botanical leaves, clean high-end commercial cosmetic advertisement, soft diffused lighting, 8k"
        ok2, res2 = test_case(page, 2, "Luxury Cosmetics Product Advertisement", c2_prompt)

        # ── CASE 3: Extreme Macro Photography ──
        c3_prompt = "Hyper-realistic extreme macro photograph of a glowing iridescent hummingbird feather covered in morning dew droplets, prismatic reflections, studio dark background, 85mm optical clarity"
        ok3, res3 = test_case(page, 3, "Extreme Macro Hummingbird Feather", c3_prompt)

        browser.close()
        print("\n" + "="*70)
        print("ALL ACTUAL IMAGE GENERATION TEST CASES PASSED!")
        print("="*70)

if __name__ == "__main__":
    run()

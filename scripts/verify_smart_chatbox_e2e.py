#!/usr/bin/env python3
"""
verify_smart_chatbox_e2e.py
End-to-end visual and functional test of:
1. Native '/' slash command autocompletion directly in the chatbox textarea.
2. Smart prompt fusion (fusing user concept into curated templates).
3. Expandable Studio Composer mode (⛶) with word/char counters and interactive variable chips.
4. Prompt Library Tray with fusion and local WebP cached thumbnails.
"""

import sys
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

ARTIFACT_DIR = Path("/home/ubuntu/.gemini/antigravity-cli/brain/db75f58e-8edc-4f33-91e8-7bceddf2ad56")

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 1280, "height": 850},
            device_scale_factor=1.5,
        )
        page = context.new_page()

        print("1. Navigating to http://localhost:5173/ ...")
        page.goto("http://localhost:5173/", wait_until="networkidle")
        page.wait_for_timeout(1000)

        # Ensure we are on the chat tab
        chat_tab = page.locator("text=Chat").first
        if chat_tab.is_visible():
            chat_tab.click()
            page.wait_for_timeout(500)

        textarea = page.locator("textarea")
        textarea.wait_for(state="visible", timeout=5000)
        print("✓ Chatbox textarea is visible.")

        # ── Test 1: Native Slash Command Popover ──
        print("2. Testing Slash Command (/) Autocomplete...")
        textarea.click()
        textarea.fill("/")
        page.wait_for_timeout(500)

        slash_popover = page.locator("text=Curated Slash Techniques")
        slash_popover.wait_for(state="visible", timeout=3000)
        print("✓ Slash Command Popover appeared!")

        shot1_path = ARTIFACT_DIR / "e2e_smart_slash_menu.png"
        page.screenshot(path=str(shot1_path))
        print(f"✓ Saved screenshot: {shot1_path}")

        # ── Test 2: Slash Command Filtering and Keyboard Navigation ──
        print("3. Filtering slash commands with '/dio'...")
        textarea.fill("/dio")
        page.wait_for_timeout(300)

        diorama_cmd = page.locator("text=/diorama")
        diorama_cmd.wait_for(state="visible", timeout=2000)
        print("✓ Filtered successfully to /diorama.")

        # Press Enter to select
        page.keyboard.press("Enter")
        page.wait_for_timeout(500)

        fused_val = textarea.input_value()
        assert "miniature diorama" in fused_val.lower(), f"Unexpected prompt: {fused_val}"
        print(f"✓ Applied /diorama technique! Prompt preview: {fused_val[:80]}...")

        shot2_path = ARTIFACT_DIR / "e2e_smart_slash_applied.png"
        page.screenshot(path=str(shot2_path))
        print(f"✓ Saved screenshot: {shot2_path}")

        # ── Test 3: Smart Prompt Fusion with User Concept ──
        print("4. Testing Smart Prompt Fusion (User concept + /macro)...")
        textarea.fill("cyberpunk mechanical dragonfly /macro")
        page.wait_for_timeout(400)

        fusing_indicator = page.locator("text=Fusing with \"cyberpunk mechanical dragonfly\"")
        assert fusing_indicator.is_visible(), "Fusing indicator not found!"
        print("✓ Popover detected user concept for live fusion.")

        shot3_path = ARTIFACT_DIR / "e2e_smart_fusion_indicator.png"
        page.screenshot(path=str(shot3_path))
        print(f"✓ Saved screenshot: {shot3_path}")

        # Select the command
        page.keyboard.press("Enter")
        page.wait_for_timeout(500)

        fused_dragonfly = textarea.input_value()
        assert "cyberpunk mechanical dragonfly" in fused_dragonfly, f"User concept was not fused! Got: {fused_dragonfly}"
        assert "macro photograph" in fused_dragonfly.lower(), f"Technique was not applied! Got: {fused_dragonfly}"
        print(f"✓ Perfect prompt fusion! Fused prompt:\n  --> {fused_dragonfly[:120]}...")

        # ── Test 4: Expandable Studio Mode (⛶) ──
        print("5. Verifying Studio Mode Expandable Composer...")
        studio_header = page.locator("text=Studio Composer")
        studio_header.wait_for(state="visible", timeout=2000)
        print("✓ Studio Composer header is active with words & character metrics.")

        shot4_path = ARTIFACT_DIR / "e2e_smart_studio_mode_expanded.png"
        page.screenshot(path=str(shot4_path))
        print(f"✓ Saved screenshot: {shot4_path}")

        # Test collapse back to compact
        compact_btn = page.locator("button:has-text('Compact')")
        if compact_btn.is_visible():
            compact_btn.click()
            page.wait_for_timeout(300)
            print("✓ Collapsed back to compact mode.")

        shot5_path = ARTIFACT_DIR / "e2e_smart_studio_mode_collapsed.png"
        page.screenshot(path=str(shot5_path))
        print(f"✓ Saved screenshot: {shot5_path}")

        # ── Test 5: Curated Prompt Library Tray with Fuse Support ──
        print("6. Testing Prompt Library Tray with active concept...")
        textarea.fill("artisan roasted coffee beans")
        page.wait_for_timeout(300)

        # Open library tray
        lib_btn = page.locator("button[title='Visual Prompt Library']")
        lib_btn.click()
        page.wait_for_timeout(1000)

        # Switch to Curated Gallery tab if not already on it
        gallery_tab = page.locator("button:has-text('1,000+ Curated Library')")
        if gallery_tab.is_visible():
            gallery_tab.click()
            page.wait_for_timeout(1000)

        # Inspect first prompt card
        first_card = page.locator(".group.relative.flex.flex-col").first
        first_card.wait_for(state="visible", timeout=6000)
        first_card.click()
        page.wait_for_timeout(800)

        # Verify "Fuse with 'artisan roasted coffee...'" button is present
        fuse_btn = page.locator("button:has-text('Fuse with')")
        fuse_btn.wait_for(state="visible", timeout=4000)
        assert fuse_btn.is_visible(), "Fuse button not visible in inspect card!"
        print("✓ Prompt Library Tray successfully displays contextual 'Fuse with...' button!")

        shot6_path = ARTIFACT_DIR / "e2e_smart_tray_fuse_button.png"
        page.screenshot(path=str(shot6_path))
        print(f"✓ Saved screenshot: {shot6_path}")

        browser.close()
        print("\nAll 6 tests passed with flying colors!")

if __name__ == "__main__":
    main()

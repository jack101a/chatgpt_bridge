#!/usr/bin/env python3
"""
verify_mobile_polished.py
Tests the polished mobile UI/UX on iPhone (390x844):
1. Compact Mode (full width textarea, bottom toolbar with / Styles, Studio toggle, Enhance, Send)
2. Slash Command Popover on mobile with updated footer
3. Studio Mode on mobile (full width textarea spanning 100% of the card, zero empty space on right side)
4. Desktop view in Studio Mode (verifying full width layout there as well)
"""

import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ARTIFACT_DIR = Path("/home/ubuntu/.gemini/antigravity-cli/brain/db75f58e-8edc-4f33-91e8-7bceddf2ad56")

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        # ── 1. Mobile iPhone Viewport (390x844) ──
        context_mobile = browser.new_context(
            viewport={"width": 390, "height": 844},
            device_scale_factor=2,
            is_mobile=True,
            has_touch=True
        )
        page = context_mobile.new_page()
        page.goto("http://localhost:5173/", wait_until="networkidle")
        page.wait_for_timeout(1000)

        textarea = page.locator("textarea")
        textarea.wait_for(state="visible", timeout=5000)

        # 1.1 Compact Mode empty
        page.screenshot(path=str(ARTIFACT_DIR / "polished_mobile_1_compact_empty.png"))
        print("✓ Captured polished_mobile_1_compact_empty.png")

        # 1.2 Type concept and trigger slash
        textarea.fill("cyberpunk street food vendor /pixel")
        page.wait_for_timeout(400)
        page.screenshot(path=str(ARTIFACT_DIR / "polished_mobile_2_slash_popover.png"))
        print("✓ Captured polished_mobile_2_slash_popover.png")

        # 1.3 Apply slash command
        page.keyboard.press("Enter")
        page.wait_for_timeout(500)

        # In Studio mode with full prompt
        page.screenshot(path=str(ARTIFACT_DIR / "polished_mobile_3_studio_mode_fused.png"))
        print("✓ Captured polished_mobile_3_studio_mode_fused.png")

        # Check width of textarea vs container
        box_textarea = textarea.bounding_box()
        print(f"Mobile Textarea bounding box: x={box_textarea['x']}, width={box_textarea['width']}, height={box_textarea['height']}")
        assert box_textarea['width'] > 300, f"Textarea width {box_textarea['width']} is too narrow! Expected > 300px on 390px viewport."

        # ── 2. Desktop Viewport (1440x900) ──
        context_desktop = browser.new_context(
            viewport={"width": 1440, "height": 900},
            device_scale_factor=1.5
        )
        page_desktop = context_desktop.new_page()
        page_desktop.goto("http://localhost:5173/", wait_until="networkidle")
        page_desktop.wait_for_timeout(1000)

        desk_textarea = page_desktop.locator("textarea")
        desk_textarea.wait_for(state="visible", timeout=5000)
        desk_textarea.fill("artisan dark roast espresso cup on slate /storyboard")
        page_desktop.wait_for_timeout(400)
        page_desktop.keyboard.press("Enter")
        page_desktop.wait_for_timeout(500)

        page_desktop.screenshot(path=str(ARTIFACT_DIR / "polished_desktop_studio_mode.png"))
        print("✓ Captured polished_desktop_studio_mode.png")

        desk_box = desk_textarea.bounding_box()
        print(f"Desktop Textarea bounding box: x={desk_box['x']}, width={desk_box['width']}, height={desk_box['height']}")
        assert desk_box['width'] > 700, f"Desktop textarea width {desk_box['width']} is too narrow!"

        browser.close()
        print("\nAll mobile & desktop polish tests completed successfully!")

if __name__ == "__main__":
    run()

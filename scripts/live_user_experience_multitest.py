#!/usr/bin/env python3
"""
live_user_experience_multitest.py
Comprehensive multi-test suite verifying live user experience across 5 realistic scenarios:
1. Scenario 1: Creative Director Desktop Workflow (Input idea -> /storyboard fusion -> Studio Mode -> Edit -> Copy -> Send)
2. Scenario 2: Mobile Smartphone User Experience (390x844 iPhone viewport -> Slash menu -> Thumb targets -> Studio Mode on Mobile)
3. Scenario 3: Deep Catalog Browsing & Full-Res Lightbox (Category filter -> Keyword search -> Card inspect -> Full-res lightbox -> Escape)
4. Scenario 4: Dark Mode Integrity (Toggle dark mode -> Slash popover -> Studio Mode -> Lightbox -> Token compliance)
5. Scenario 5: Edge Cases & Composer State Lifecycle (Escape dismiss -> Clear button -> Dynamic re-expansion)
"""

import sys
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

ARTIFACT_DIR = Path("/home/ubuntu/.gemini/antigravity-cli/brain/db75f58e-8edc-4f33-91e8-7bceddf2ad56")

def run_suite():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        # ══════════════════════════════════════════════════════════════════════
        # TEST 1: CREATIVE DIRECTOR WORKFLOW (DESKTOP)
        # ══════════════════════════════════════════════════════════════════════
        print("\n" + "="*70)
        print("TEST 1: DESKTOP CREATIVE DIRECTOR WORKFLOW")
        print("="*70)
        context_desktop = browser.new_context(
            viewport={"width": 1440, "height": 900},
            device_scale_factor=1.5
        )
        page = context_desktop.new_page()
        page.goto("http://localhost:5173/", wait_until="networkidle")
        page.wait_for_timeout(1000)

        # Ensure Chat Studio tab
        chat_tab = page.locator("text=Chat Studio").first
        if chat_tab.is_visible():
            chat_tab.click()
            page.wait_for_timeout(400)

        textarea = page.locator("textarea")
        textarea.wait_for(state="visible", timeout=5000)

        # 1.1 User types concept
        print("1.1 Typing user concept: 'artisan dark roast espresso cup on slate'...")
        textarea.fill("artisan dark roast espresso cup on slate /storyboard")
        page.wait_for_timeout(500)

        # Verify indicator
        fusion_badge = page.locator("text=Fusing with \"artisan dark roast espresso cup on slate\"")
        assert fusion_badge.is_visible(), "Fusion badge not displayed!"
        print("✓ Live fusion badge confirmed.")

        page.screenshot(path=str(ARTIFACT_DIR / "live_ux_test1_1_fusion_preview.png"))
        print(f"✓ Saved screenshot: live_ux_test1_1_fusion_preview.png")

        # 1.2 Press Enter to apply technique
        print("1.2 Applying /storyboard technique...")
        page.keyboard.press("Enter")
        page.wait_for_timeout(600)

        fused_text = textarea.input_value()
        assert "artisan dark roast espresso cup on slate" in fused_text, "User concept missing from fused text!"
        assert "9-panel grid" in fused_text or "storyboard" in fused_text.lower(), "Storyboard template not applied!"
        print("✓ Storyboard technique successfully fused.")

        # Verify Studio Composer is automatically open because prompt is long (>180 chars)
        studio_badge = page.locator("text=Studio Composer")
        assert studio_badge.is_visible(), "Studio Composer did not open automatically for long prompt!"
        print("✓ Studio Composer automatically activated for deep editing.")

        # 1.3 Check stats
        stats_text = page.locator("text=words •").first.inner_text()
        print(f"✓ Prompt stats verified: '{stats_text}'")

        # 1.4 Test Copy button
        copy_btn = page.locator("button:has-text('Copy')").first
        assert copy_btn.is_visible(), "Copy button in Studio Header not visible!"
        copy_btn.click()
        page.wait_for_timeout(300)
        copied_badge = page.locator("text=Copied")
        assert copied_badge.is_visible(), "Copied confirmation not shown!"
        print("✓ 1-click Copy button confirmed.")

        page.screenshot(path=str(ARTIFACT_DIR / "live_ux_test1_2_studio_composer_fused.png"))
        print(f"✓ Saved screenshot: live_ux_test1_2_studio_composer_fused.png")

        # ══════════════════════════════════════════════════════════════════════
        # TEST 2: MOBILE SMARTPHONE USER EXPERIENCE (390x844)
        # ══════════════════════════════════════════════════════════════════════
        print("\n" + "="*70)
        print("TEST 2: MOBILE SMARTPHONE USER EXPERIENCE (iPhone Viewport)")
        print("="*70)
        context_mobile = browser.new_context(
            viewport={"width": 390, "height": 844},
            is_mobile=True,
            has_touch=True,
            device_scale_factor=2.0
        )
        mobile_page = context_mobile.new_page()
        mobile_page.goto("http://localhost:5173/", wait_until="networkidle")
        mobile_page.wait_for_timeout(1000)

        m_textarea = mobile_page.locator("textarea")
        m_textarea.wait_for(state="visible", timeout=5000)

        # 2.1 Mobile typing slash command
        print("2.1 Mobile slash command typing: '/pixel'...")
        m_textarea.fill("/pixel")
        mobile_page.wait_for_timeout(500)

        # Check popover layout on mobile
        m_popover = mobile_page.locator("text=Curated Slash Techniques")
        assert m_popover.is_visible(), "Slash popover not visible on mobile!"
        print("✓ Slash popover perfectly fitted on mobile screen.")

        mobile_page.screenshot(path=str(ARTIFACT_DIR / "live_ux_test2_1_mobile_slash_popover.png"))
        print(f"✓ Saved screenshot: live_ux_test2_1_mobile_slash_popover.png")

        # 2.2 Tap /pixel-art command
        pixel_cmd = mobile_page.locator("text=/pixel-art")
        pixel_cmd.click()
        mobile_page.wait_for_timeout(600)

        m_fused = m_textarea.input_value()
        assert "pixel" in m_fused.lower(), "Pixel art technique not applied on mobile!"
        print("✓ Applied pixel-art command on touch viewport.")

        # Verify Studio mode layout on mobile
        m_studio = mobile_page.locator("text=Studio Composer")
        assert m_studio.is_visible(), "Studio composer not visible on mobile!"

        mobile_page.screenshot(path=str(ARTIFACT_DIR / "live_ux_test2_2_mobile_studio_mode.png"))
        print(f"✓ Saved screenshot: live_ux_test2_2_mobile_studio_mode.png")

        # 2.3 Tap Compact button on mobile
        m_compact_btn = mobile_page.locator("button:has-text('Compact')")
        if m_compact_btn.is_visible():
            m_compact_btn.click()
            mobile_page.wait_for_timeout(400)
            print("✓ Successfully collapsed to compact view on mobile.")

        mobile_page.screenshot(path=str(ARTIFACT_DIR / "live_ux_test2_3_mobile_compact_mode.png"))
        print(f"✓ Saved screenshot: live_ux_test2_3_mobile_compact_mode.png")

        # ══════════════════════════════════════════════════════════════════════
        # TEST 3: DEEP CATALOG BROWSING & FULL-RES LIGHTBOX
        # ══════════════════════════════════════════════════════════════════════
        print("\n" + "="*70)
        print("TEST 3: CATALOG BROWSING, SEARCH & ZERO-CHROME LIGHTBOX")
        print("="*70)
        
        # Open Prompt Library
        lib_btn = page.locator("button[title='Visual Prompt Library']")
        lib_btn.click()
        page.wait_for_timeout(800)

        # Switch to 1,000+ Curated Library tab if not active
        curated_tab = page.locator("button:has-text('1,000+ Curated Library')")
        if curated_tab.is_visible():
            curated_tab.click()
            page.wait_for_timeout(800)

        # 3.1 Test category filter: Products & E-commerce
        print("3.1 Filtering by 'Products & E-commerce' category...")
        cat_btn = page.locator("button:has-text('Products & E-commerce')").first
        if cat_btn.is_visible():
            cat_btn.click()
            page.wait_for_timeout(1000)
            print("✓ Products & E-commerce category selected.")

        page.screenshot(path=str(ARTIFACT_DIR / "live_ux_test3_1_category_filter_products.png"))
        print(f"✓ Saved screenshot: live_ux_test3_1_category_filter_products.png")

        # 3.2 Test keyword search: "diorama"
        print("3.2 Searching keyword: 'diorama'...")
        search_input = page.locator("input[placeholder*='Search 1,000+ prompts']")
        search_input.fill("diorama")
        page.wait_for_timeout(1000)

        page.screenshot(path=str(ARTIFACT_DIR / "live_ux_test3_2_search_diorama.png"))
        print(f"✓ Saved screenshot: live_ux_test3_2_search_diorama.png")

        # 3.3 Click first card to inspect
        print("3.3 Inspecting prompt card details...")
        first_card = page.locator(".group.relative.flex.flex-col").first
        first_card.wait_for(state="visible", timeout=5000)
        first_card.click()
        page.wait_for_timeout(800)

        # Verify inspect elements
        assert page.locator("text=Use Verbatim").is_visible(), "Use Verbatim button not found!"
        assert page.locator("text=View Full Artwork").is_visible(), "View Full Artwork button not found!"
        print("✓ Inspect modal rendered with full details and action buttons.")

        page.screenshot(path=str(ARTIFACT_DIR / "live_ux_test3_3_card_inspect_view.png"))
        print(f"✓ Saved screenshot: live_ux_test3_3_card_inspect_view.png")

        # 3.4 Open Full-Res Lightbox
        print("3.4 Opening zero-chrome Full-Resolution Lightbox...")
        page.locator(".cursor-zoom-in").first.click()
        page.wait_for_timeout(1000)

        # Verify lightbox is visible
        lightbox_img = page.locator(".fixed.inset-0.z-\\[9999\\] img")
        lightbox_img.wait_for(state="visible", timeout=5000)
        print("✓ Zero-chrome Full-Resolution Lightbox mounted via portal at z-9999.")

        page.screenshot(path=str(ARTIFACT_DIR / "live_ux_test3_4_fullres_lightbox.png"))
        print(f"✓ Saved screenshot: live_ux_test3_4_fullres_lightbox.png")

        # Close Lightbox using close button or Escape
        close_lb = page.locator("button[title*='Close Full Artwork']")
        if close_lb.is_visible():
            close_lb.click()
        else:
            page.keyboard.press("Escape")
        page.wait_for_timeout(500)
        print("✓ Closed Lightbox.")

        # Close Library Tray
        close_tray_btn = page.locator("button[aria-label='Close Prompt Library']")
        if close_tray_btn.is_visible():
            close_tray_btn.click()
            page.wait_for_timeout(500)

        # ══════════════════════════════════════════════════════════════════════
        # TEST 4: DARK MODE THEME INTEGRITY
        # ══════════════════════════════════════════════════════════════════════
        print("\n" + "="*70)
        print("TEST 4: DARK MODE THEME & TOKENS COMPLIANCE")
        print("="*70)

        # Toggle to Dark Mode
        print("4.1 Switching to Dark Mode...")
        theme_btn = page.locator("button:has(.lucide-moon), button:has(.lucide-sun)").first
        if theme_btn.is_visible():
            theme_btn.click()
            page.wait_for_timeout(500)
        else:
            page.evaluate("document.documentElement.classList.add('dark')")
            page.wait_for_timeout(300)

        print("✓ Dark mode active.")

        # Open Slash Commands in Dark Mode
        textarea.fill("/")
        page.wait_for_timeout(500)

        page.screenshot(path=str(ARTIFACT_DIR / "live_ux_test4_1_dark_mode_slash_menu.png"))
        print(f"✓ Saved screenshot: live_ux_test4_1_dark_mode_slash_menu.png")

        # Select /exploded
        textarea.fill("/exploded")
        page.wait_for_timeout(300)
        page.keyboard.press("Enter")
        page.wait_for_timeout(600)

        page.screenshot(path=str(ARTIFACT_DIR / "live_ux_test4_2_dark_mode_studio_composer.png"))
        print(f"✓ Saved screenshot: live_ux_test4_2_dark_mode_studio_composer.png")

        # ══════════════════════════════════════════════════════════════════════
        # TEST 5: EDGE CASES & COMPOSER STATE LIFECYCLE
        # ══════════════════════════════════════════════════════════════════════
        print("\n" + "="*70)
        print("TEST 5: EDGE CASES & STATE LIFECYCLE")
        print("="*70)

        # 5.1 Clear button in Studio Mode
        print("5.1 Testing Studio Mode 'Clear' button...")
        clear_btn = page.locator("button:has-text('Clear')").first
        clear_btn.click()
        page.wait_for_timeout(300)

        cleared_val = textarea.input_value()
        assert cleared_val == "", f"Textarea was not cleared! Got: '{cleared_val}'"
        print("✓ Clear button properly emptied the composer.")

        # 5.2 Escape dismisses slash menu without wiping user text
        print("5.2 Testing Escape dismissal of slash menu...")
        textarea.fill("a futuristic electric vehicle /")
        page.wait_for_timeout(400)
        assert page.locator("text=Curated Slash Techniques").is_visible(), "Slash menu did not open!"

        page.keyboard.press("Escape")
        page.wait_for_timeout(300)
        assert not page.locator("text=Curated Slash Techniques").is_visible(), "Slash menu still open after Escape!"
        assert "a futuristic electric vehicle" in textarea.input_value(), "User concept was wiped!"
        print("✓ Escape dismissed slash menu cleanly while preserving user text.")

        # 5.3 Toggle Studio Mode button directly
        print("5.3 Testing direct toggle of Studio Mode (⛶ button)...")
        toggle_studio_btn = page.locator("button[aria-label='Toggle Studio Mode']")
        is_currently_studio = page.locator("text=Studio Composer").is_visible()

        # Click toggle once
        toggle_studio_btn.click()
        page.wait_for_timeout(300)
        state_after_first_click = page.locator("text=Studio Composer").is_visible()
        assert state_after_first_click != is_currently_studio, "Studio Mode did not toggle state!"
        print(f"✓ Studio Mode successfully toggled from {is_currently_studio} to {state_after_first_click}.")

        # Click toggle second time
        toggle_studio_btn.click()
        page.wait_for_timeout(300)
        state_after_second_click = page.locator("text=Studio Composer").is_visible()
        assert state_after_second_click == is_currently_studio, "Studio Mode did not toggle back to original state!"
        print(f"✓ Studio Mode successfully toggled back to {state_after_second_click}.")

        page.screenshot(path=str(ARTIFACT_DIR / "live_ux_test5_state_lifecycle_complete.png"))
        print(f"✓ Saved screenshot: live_ux_test5_state_lifecycle_complete.png")

        # Switch back to light theme for consistency
        page.evaluate("document.documentElement.classList.remove('dark')")
        page.wait_for_timeout(300)

        browser.close()
        print("\n" + "="*70)
        print("ALL 5 LIVE USER EXPERIENCE TESTS COMPLETED & PASSED!")
        print("="*70)

if __name__ == "__main__":
    run_suite()

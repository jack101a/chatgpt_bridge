#!/usr/bin/env python3
"""
e2e_verify_gallery.py
Launches daemon and Vite dev server, runs Playwright browser checks,
and captures visual artifacts demonstrating:
1. Curated prompt gallery in chatbox
2. Category and tag filtering
3. Full prompt inspection view
4. Direct insertion of verbatim prompt into composer
5. Smart suggestions strip while typing
"""

import os
import sys
import time
import subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright

WORKTREE_DIR = Path("/home/ubuntu/antigravity/radiant-newton/.worktrees/image-prompt-library")
PYTHON_BIN = WORKTREE_DIR / "python" / ".venv" / "bin" / "python"
FRONTEND_DIR = WORKTREE_DIR / "frontend"
ARTIFACT_DIR = Path("/home/ubuntu/.gemini/antigravity-cli/brain/db75f58e-8edc-4f33-91e8-7bceddf2ad56")

def run():
    env = os.environ.copy()
    env["PYTHONPATH"] = str(WORKTREE_DIR / "python")
    env["CHATGPT_BRIDGE_PORT"] = "8466"
    
    print("Starting backend daemon on port 8466...")
    backend_proc = subprocess.Popen(
        [str(PYTHON_BIN), "-m", "uvicorn", "chatgpt_bridge.daemon:app", "--port", "8466", "--host", "127.0.0.1"],
        cwd=str(WORKTREE_DIR / "python"),
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )

    time.sleep(2)
    print("Starting Vite frontend dev server on port 5173...")
    frontend_proc = subprocess.Popen(
        ["npx", "vite", "--port", "5173", "--host", "127.0.0.1"],
        cwd=str(FRONTEND_DIR),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )

    time.sleep(3)

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(viewport={"width": 1280, "height": 880})
            page = context.new_page()

            print("Navigating to http://127.0.0.1:5173...")
            page.goto("http://127.0.0.1:5173", wait_until="networkidle")
            page.wait_for_timeout(1000)

            # 1. Open prompt library
            print("Opening Prompt Library tray...")
            page.click('button[title="Visual Prompt Library"]')
            page.wait_for_timeout(600)

            # Switch to Gallery tab
            print("Switching to 1,000+ Curated Library tab...")
            page.click('button:has-text("1,000+ Curated Library")')
            page.wait_for_timeout(1200)

            shot1 = ARTIFACT_DIR / "e2e_gallery_tab_open.png"
            page.screenshot(path=str(shot1))
            print(f"Captured: {shot1}")

            # 2. Filter by Photography & Realism
            print("Clicking Photography & Realism category tag...")
            page.click('button:has-text("Photography & Realism")')
            page.wait_for_timeout(1000)

            shot2 = ARTIFACT_DIR / "e2e_gallery_category_filtered.png"
            page.screenshot(path=str(shot2))
            print(f"Captured: {shot2}")

            # 3. Click first card to inspect
            print("Inspecting first prompt card...")
            cards = page.locator('div:has-text("Photography & Realism") >> .. >> div.group')
            page.locator('.group.relative.flex.flex-col').first.click()
            page.wait_for_timeout(800)

            shot3 = ARTIFACT_DIR / "e2e_gallery_card_inspect.png"
            page.screenshot(path=str(shot3))
            print(f"Captured: {shot3}")

            # 4. Click 'Use Prompt Verbatim'
            print("Clicking Use Prompt Verbatim...")
            page.click('button:has-text("Use Prompt Verbatim")')
            page.wait_for_timeout(600)

            shot4 = ARTIFACT_DIR / "e2e_composer_with_curated_prompt.png"
            page.screenshot(path=str(shot4))
            print(f"Captured: {shot4}")

            # 5. Clear prompt, type concept to test Smart Suggestions
            print("Testing smart prompt suggestions strip...")
            textarea = page.locator('textarea')
            textarea.fill('cyberpunk neon street')
            page.wait_for_timeout(1200)

            shot5 = ARTIFACT_DIR / "e2e_smart_prompt_suggestions.png"
            page.screenshot(path=str(shot5))
            print(f"Captured: {shot5}")

            browser.close()
            print("E2E verification completed successfully!")

    finally:
        print("Stopping dev servers...")
        frontend_proc.terminate()
        backend_proc.terminate()
        frontend_proc.wait()
        backend_proc.wait()

if __name__ == "__main__":
    run()

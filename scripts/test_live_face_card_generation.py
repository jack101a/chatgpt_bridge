import asyncio
import time
from pathlib import Path
from playwright.async_api import async_playwright

ARTIFACT_DIR = Path("/home/ubuntu/.gemini/antigravity-cli/brain/db75f58e-8edc-4f33-91e8-7bceddf2ad56")

async def run_live_test():
    print("=== STARTING LIVE FACE CARD GENERATION TEST ===")
    t0 = time.time()
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1440, "height": 900})
        page = await context.new_page()

        # 1. Go to Reference Cards tab
        print("1. Loading http://localhost:8466/#generator...")
        await page.goto("http://localhost:8466/#generator", wait_until="networkidle")
        await asyncio.sleep(1)

        # 2. Verify prompt preview exists
        prompt_text = await page.locator("pre").inner_text()
        print(f"Initial compiled prompt preview ({len(prompt_text)} chars):")
        print(prompt_text[:200] + "...")

        # 3. Click Generate Face Card button
        print("2. Clicking 'Generate Face Card' button...")
        gen_btn = page.locator("button:has-text('Generate Face Card')").first
        await gen_btn.click()
        print("Clicked! Waiting for generation to complete...")

        # 4. Wait for generated image result card to appear
        # Timeout 240 seconds
        result_card = page.locator("text=Face Reference Card Generated")
        try:
            await result_card.wait_for(state="visible", timeout=240000)
            print(f"Generation finished in {time.time() - t0:.1f}s!")
        except Exception as e:
            # Capture error screenshot if timed out
            err_shot = ARTIFACT_DIR / "live_generation_timeout.png"
            await page.screenshot(path=str(err_shot))
            print(f"Generation failed or timed out: {e}. Screenshot: {err_shot}")
            await browser.close()
            return

        await asyncio.sleep(2)

        # 5. Capture screenshot of the UI with generated 16:9 Face Reference Card
        shot_ui = ARTIFACT_DIR / "live_face_card_generated_ui.png"
        await page.screenshot(path=str(shot_ui))
        print(f"Captured UI with result -> {shot_ui}")

        # 6. Extract the image source URL and save the raw image to artifacts
        img_locator = page.locator("img[alt='Generated Face Identity Reference Card']")
        img_src = await img_locator.get_attribute("src")
        print(f"Generated image source: {img_src}")

        # 7. Test Assignment: Click 'Save as New Character'
        print("3. Testing character assignment workflow...")
        assign_btn = page.locator("button:has-text('Save as New Character')").first
        await assign_btn.click()
        await asyncio.sleep(1)

        # Capture modal screenshot
        shot_modal = ARTIFACT_DIR / "live_face_card_assign_modal.png"
        await page.screenshot(path=str(shot_modal))
        print(f"Captured assignment modal -> {shot_modal}")

        # Click Save & Assign Lock in modal
        print("4. Confirming assignment in modal...")
        confirm_btn = page.locator("button:has-text('Save & Assign Lock')").first
        await confirm_btn.click()
        await asyncio.sleep(2)

        # Capture post-assignment success
        shot_success = ARTIFACT_DIR / "live_face_card_assigned_success.png"
        await page.screenshot(path=str(shot_success))
        print(f"Captured post-assignment -> {shot_success}")

        await browser.close()
        print(f"=== TEST COMPLETE IN {time.time() - t0:.1f}s ===")

if __name__ == "__main__":
    asyncio.run(run_live_test())

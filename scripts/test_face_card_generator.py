import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

ARTIFACT_DIR = Path("/home/ubuntu/.gemini/antigravity-cli/brain/db75f58e-8edc-4f33-91e8-7bceddf2ad56")

async def test_face_card_generator():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1440, "height": 900})
        page = await context.new_page()

        print("1. Navigating to http://localhost:8466/#generator...")
        await page.goto("http://localhost:8466/#generator", wait_until="networkidle")
        await asyncio.sleep(1.5)

        # Screenshot initial face card studio
        shot1 = ARTIFACT_DIR / "face_card_studio_initial.png"
        await page.screenshot(path=str(shot1))
        print(f"Captured initial view -> {shot1}")

        # Test selecting an archetype
        print("2. Selecting 'East Asian Minimalist' preset...")
        select = page.locator("select").first
        await select.select_option("east_asian_modern")
        await asyncio.sleep(0.5)

        shot2 = ARTIFACT_DIR / "face_card_archetype_selected.png"
        await page.screenshot(path=str(shot2))
        print(f"Captured archetype view -> {shot2}")

        # Test clicking Randomize
        print("3. Clicking '🎲 Randomize'...")
        dice_btn = page.locator("button:has-text('Randomize')").first
        await dice_btn.click()
        await asyncio.sleep(0.8)

        shot3 = ARTIFACT_DIR / "face_card_randomized.png"
        await page.screenshot(path=str(shot3))
        print(f"Captured randomized view -> {shot3}")

        # Test expanding Eyes accordion
        print("4. Expanding '3. Eyes & Gaze' accordion...")
        eyes_accordion = page.locator("button:has-text('3. Eyes & Gaze')").first
        if await eyes_accordion.count() > 0:
            await eyes_accordion.click()
            await asyncio.sleep(0.5)

        shot4 = ARTIFACT_DIR / "face_card_eyes_expanded.png"
        await page.screenshot(path=str(shot4))
        print(f"Captured eyes accordion -> {shot4}")

        # Test sub-tabs (Body card roadmap)
        print("5. Clicking 'Body Card' sub-tab...")
        body_tab = page.locator("button:has-text('Body Card')").first
        await body_tab.click()
        await asyncio.sleep(0.5)

        shot5 = ARTIFACT_DIR / "face_card_body_roadmap.png"
        await page.screenshot(path=str(shot5))
        print(f"Captured body roadmap -> {shot5}")

        # Return to Face card
        print("6. Returning to 'Face Card' sub-tab...")
        face_tab = page.locator("button:has-text('Face Card')").first
        await face_tab.click()
        await asyncio.sleep(0.5)

        await browser.close()
        print("Test completed successfully!")

if __name__ == "__main__":
    asyncio.run(test_face_card_generator())

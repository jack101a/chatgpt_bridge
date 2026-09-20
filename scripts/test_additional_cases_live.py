import time
import requests
from pathlib import Path
from playwright.sync_api import sync_playwright

API_BASE = "http://localhost:8466"
UI_BASE = "http://localhost:5173"
ARTIFACT_DIR = Path("/home/ubuntu/.gemini/antigravity-cli/brain/db75f58e-8edc-4f33-91e8-7bceddf2ad56")

TEST_CASES = [
    {
        "id": 4,
        "title": "Cinematic Portrait / Master Watchmaker",
        "category": "Cinematic Portraiture",
        "prompt": "An intimate, eye-level cinematic 35mm film photograph of an elderly master watchmaker with expressive eyes and silver hair, working delicately on an exposed antique pocket watch with a jeweler loupe in a warm moody workshop, soft volumetric dust motes, bokeh, Rembrandt lighting, 8k resolution",
        "use_studio": True,
    },
    {
        "id": 5,
        "title": "Minimalist Architecture Pavilion",
        "category": "Architectural Design",
        "prompt": "Architectural photography of a serene minimalist concrete and warm oak pavilion villa over a tranquil infinity reflecting pool at dusk, warm ambient recessed lighting, misty pine mountains in background, clean geometric lines, 8k",
        "use_studio": False,
    },
    {
        "id": 6,
        "title": "Studio Ghibli Seaside Railway",
        "category": "Anime & Concept Art",
        "prompt": "A breathtaking Studio Ghibli inspired anime landscape painting of a cozy coastal railway station during golden hour, blooming pink cherry blossoms fluttering in the breeze, vibrant watercolor textures, nostalgic serene mood, high aesthetic detail",
        "use_studio": True,
    }
]

def run_additional_tests():
    print("Connecting to Playwright browser context...")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()
        page.goto(UI_BASE, wait_until="networkidle")
        page.wait_for_timeout(2000)

        for case in TEST_CASES:
            case_id = case["id"]
            title = case["title"]
            prompt = case["prompt"]
            use_studio = case["use_studio"]

            print(f"\n{'='*70}\nSTARTING CASE {case_id}: {title}\nPrompt: {prompt[:80]}...\n{'='*70}")

            # Click "+ / New Chat" button in sidebar to start a clean thread for isolation
            new_chat_btn = page.locator("button[title*='New thread'], button:has-text('New thread'), button:has-text('+')").first
            # Find and click new chat
            page.locator("header, aside").locator("button").filter(has_text="").first
            # Or click the new chat button near Bridge Studio
            new_btn = page.locator("button:has-text('+')").first
            if new_btn.is_visible():
                new_btn.click()
                page.wait_for_timeout(1000)
                print("✓ Started fresh conversation thread")

            # Check studio mode toggle if requested
            studio_btn = page.locator("button:has-text('Studio')").first
            if use_studio and studio_btn.is_visible():
                studio_btn.click()
                page.wait_for_timeout(500)
                print("✓ Switched to Studio Mode")
            elif not use_studio:
                compact_btn = page.locator("button:has-text('Compact')").first
                if compact_btn.is_visible():
                    compact_btn.click()
                    page.wait_for_timeout(500)
                    print("✓ Switched to Compact Mode")

            # Find textarea
            textarea = page.locator("textarea").first
            textarea.fill(prompt)
            page.wait_for_timeout(600)

            # Screenshot prompt ready state
            ready_ss = ARTIFACT_DIR / f"actual_gen_case{case_id}_1_prompt_ready.png"
            page.screenshot(path=str(ready_ss))
            print(f"✓ Screenshot captured: {ready_ss.name}")

            # Count initial images
            initial_count = len(page.locator("img[src*='/images/']").all())

            # Click Send button
            send_btn = page.locator("button:has-text('Send'), button[title*='Send']").first
            if not send_btn.is_visible() or send_btn.is_disabled():
                # Try finding emerald up-arrow button
                send_btn = page.locator("button.bg-emerald-600, button.bg-emerald-500, button:has(svg.lucide-arrow-up)").first
            send_btn.click()
            print("✓ Generation dispatched. Monitoring progress...")

            t0 = time.time()
            success = False
            result_src = ""

            for sec in range(200):
                # Check for progress status
                prog = page.locator("text=Submitting prompt, text=Submitting to engine, text=Generating, text=Refining").first
                if prog.is_visible():
                    print(f"[{int(time.time()-t0)}s] Live status: {prog.inner_text()}", end="\r")

                # Check for newly rendered image
                imgs = page.locator("img[src*='/images/']").all()
                if len(imgs) > initial_count:
                    latest = imgs[-1]
                    if latest.is_visible():
                        result_src = latest.get_attribute("src")
                        print(f"\n✓ New artwork rendered! src={result_src}")
                        page.wait_for_timeout(2000)
                        res_ss = ARTIFACT_DIR / f"actual_gen_case{case_id}_2_result_ui.png"
                        page.screenshot(path=str(res_ss))
                        print(f"✓ UI Screenshot saved: {res_ss.name}")

                        # Copy full resolution image to artifact directory
                        img_filename = Path(result_src).name
                        local_full_path = Path("/home/ubuntu/.chatgpt-bridge/images") / img_filename
                        if local_full_path.exists():
                            import shutil
                            art_img = ARTIFACT_DIR / f"actual_gen_case{case_id}_{title.lower().replace(' ', '_').replace('/', '_')}.png"
                            shutil.copy(local_full_path, art_img)
                            print(f"✓ Full-res artwork copied: {art_img.name} ({local_full_path.stat().st_size / 1024 / 1024:.2f} MB)")

                        success = True
                        break

                # Check error
                err = page.locator("text=Failed:").first
                if err.is_visible():
                    print(f"\n❌ Generation failed: {err.inner_text()}")
                    err_ss = ARTIFACT_DIR / f"actual_gen_case{case_id}_error.png"
                    page.screenshot(path=str(err_ss))
                    break

                page.wait_for_timeout(1000)

            dur = time.time() - t0
            if not success:
                print(f"\n❌ Case {case_id} timed out or failed after {dur:.1f}s")
            else:
                print(f"✓ Case {case_id} completed successfully in {dur:.1f} seconds!")

        # After all cases, open Gallery to verify all generated items show up in Gallery
        print("\nVerifying Image Gallery view...")
        gallery_nav = page.locator("button:has-text('Image Gallery'), a:has-text('Image Gallery')").first
        if gallery_nav.is_visible():
            gallery_nav.click()
            page.wait_for_timeout(2500)
            gal_ss = ARTIFACT_DIR / "actual_gen_gallery_all_results.png"
            page.screenshot(path=str(gal_ss))
            print(f"✓ Gallery view captured: {gal_ss.name}")

        browser.close()

    print("\n======================================================================")
    print("ALL ADDITIONAL IMAGE GENERATION TEST CASES FINISHED")
    print("======================================================================")

if __name__ == "__main__":
    run_additional_tests()

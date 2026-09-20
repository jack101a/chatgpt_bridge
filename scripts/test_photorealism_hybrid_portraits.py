import time
import shutil
import requests
from pathlib import Path
from playwright.sync_api import sync_playwright

API_BASE = "http://localhost:8466"
UI_BASE = "http://localhost:5173"
ARTIFACT_DIR = Path("/home/ubuntu/.gemini/antigravity-cli/brain/db75f58e-8edc-4f33-91e8-7bceddf2ad56")
IMAGES_DIR = Path("/home/ubuntu/.chatgpt-bridge/images")

PORTRAIT_CASES = [
    {
        "id": "hybrid_1_prism",
        "title": "Prismatic Crystal Refraction & Golden Hour Portrait",
        "style_slash": "/editorial",
        "prompt": "Award-winning photorealistic editorial portrait of a young woman with warm honey-brown eyes, natural freckles across her nose, and subtle windblown flyaway hair. She is captured through a hand-held faceted crystal prism, casting ethereal rainbow caustics and prismatic chromatic light across her cheek and collarbone. Ultra-realistic unretouched skin texture with visible micro-pores and delicate peach fuzz, soft golden hour sunlight, 85mm f/1.4 lens, shallow depth of field, creamy bokeh, Kodak Portra 400 film tones, 8K commercial fashion magazine aesthetic.",
        "use_enhance": False
    },
    {
        "id": "hybrid_2_botanical",
        "title": "Bioluminescent Botanical Couture Fashion Portrait",
        "style_slash": "/macro",
        "prompt": "A breathtaking high-fashion editorial photograph of an East Asian model wearing avant-garde couture made from translucent living moth orchid petals and delicate dewy ferns. Microscopic glowing bioluminescent moss spores emit a soft cyan and emerald luminescence illuminating her jawline and collarbone. Hyper-realistic skin texture, authentic water droplets resting on her skin, soft atmospheric mist, dramatic chiaroscuro studio lighting, shot on Hasselblad H6D-100c medium format, cinematic realism, 8K.",
        "use_enhance": False
    },
    {
        "id": "hybrid_3_cyberpunk_rain",
        "title": "Rain-Drenched Neo-Tokyo Cyberpunk Portrait",
        "style_slash": "/cyberpunk",
        "prompt": "Cinematic photorealistic medium close-up portrait of a stylish young East Asian girl with a textured wolf-cut hairstyle holding a clear transparent umbrella in a rain-drenched neon alleyway. Raindrops run down the plastic umbrella surface reflecting vibrant magenta and electric blue holographic signs. Realistic wet skin texture, damp locks of hair adhering naturally to her temples, authentic damp wool jacket textures, 35mm anamorphic lens, beautiful cinematic anamorphic horizontal lens flare, moody atmospheric depth, photorealistic 8K.",
        "use_enhance": False
    }
]

def run_tests():
    print("Connecting to Playwright browser context...")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = browser.new_page()
        page.goto(UI_BASE, wait_until="networkidle")
        page.wait_for_timeout(2000)

        for case in PORTRAIT_CASES:
            cid = case["id"]
            title = case["title"]
            prompt = case["prompt"]
            slash = case["style_slash"]

            print(f"\n{'='*75}\nEXECUTING CASE: {title}\nSlash style: {slash}\n{'='*75}")

            # Start fresh conversation thread for clean context
            new_btn = page.locator("button:has-text('+')").first
            if new_btn.is_visible():
                new_btn.click()
                page.wait_for_timeout(800)

            # Ensure Studio Mode is active
            studio_btn = page.locator("button:has-text('Studio')").first
            if studio_btn.is_visible():
                studio_btn.click()
                page.wait_for_timeout(400)

            # Fill textarea
            textarea = page.locator("textarea").first
            textarea.fill(prompt)
            page.wait_for_timeout(500)

            # Screenshot prompt ready in Studio Composer
            prompt_ss = ARTIFACT_DIR / f"portrait_gen_{cid}_1_prompt_ready.png"
            page.screenshot(path=str(prompt_ss))
            print(f"✓ Screenshot captured: {prompt_ss.name}")

            # Count initial images
            initial_count = len(page.locator("img[src*='/images/']").all())

            # Click send button
            send_btn = page.locator("button:has-text('Send'), button[title*='Send']").first
            if not send_btn.is_visible() or send_btn.is_disabled():
                send_btn = page.locator("button.bg-emerald-600, button.bg-emerald-500, button:has(svg.lucide-arrow-up)").first
            send_btn.click()
            print("✓ Generation dispatched. Waiting for ChatGPT Bridge response...")

            t0 = time.time()
            success = False
            result_src = ""

            for sec in range(200):
                # Check status text in UI
                prog = page.locator("text=Submitting prompt, text=Submitting to engine, text=Generating, text=Refining").first
                if prog.is_visible():
                    print(f"[{int(time.time()-t0)}s] Status: {prog.inner_text()}", end="\r")

                # Check if new image appeared
                imgs = page.locator("img[src*='/images/']").all()
                if len(imgs) > initial_count:
                    latest = imgs[-1]
                    if latest.is_visible():
                        result_src = latest.get_attribute("src")
                        print(f"\n✓ New artwork rendered in UI! src={result_src}")
                        page.wait_for_timeout(2000)

                        # UI screenshot of conversation thread
                        res_ss = ARTIFACT_DIR / f"portrait_gen_{cid}_2_ui_thread.png"
                        page.screenshot(path=str(res_ss))
                        print(f"✓ Thread screenshot saved: {res_ss.name}")

                        # Copy full-resolution image to artifacts
                        img_filename = Path(result_src).name
                        local_full = IMAGES_DIR / img_filename
                        if local_full.exists():
                            art_full = ARTIFACT_DIR / f"portrait_gen_{cid}_artwork.png"
                            shutil.copy(local_full, art_full)
                            size_mb = local_full.stat().st_size / (1024 * 1024)
                            print(f"✓ Full-res artwork saved: {art_full.name} ({size_mb:.2f} MB)")

                        success = True
                        break

                # Check error
                err = page.locator("text=Failed:").first
                if err.is_visible():
                    print(f"\n❌ Generation failed: {err.inner_text()}")
                    page.screenshot(path=str(ARTIFACT_DIR / f"portrait_gen_{cid}_error.png"))
                    break

                page.wait_for_timeout(1000)

            dur = time.time() - t0
            if success:
                print(f"✓ Case {cid} completed in {dur:.1f} seconds!")
            else:
                print(f"❌ Case {cid} timed out after {dur:.1f} seconds")

        # Capture final Gallery view showing all generated portraits
        print("\nOpening Image Gallery to verify portrait thumbnails and layout...")
        gallery_btn = page.locator("button:has-text('Image Gallery'), a:has-text('Image Gallery')").first
        if gallery_btn.is_visible():
            gallery_btn.click()
            page.wait_for_timeout(2500)
            grid_btn = page.locator("button[title*='Grid'], button:has(svg.lucide-layout-grid)").first
            if grid_btn.is_visible():
                grid_btn.click()
                page.wait_for_timeout(2000)
            page.screenshot(path=str(ARTIFACT_DIR / "portrait_gen_gallery_all_portraits.png"))
            print("✓ Gallery grid screenshot saved: portrait_gen_gallery_all_portraits.png")

        browser.close()

    print("\n======================================================================")
    print("ALL PHOTOREALISTIC HYBRID PORTRAIT GENERATIONS COMPLETED")
    print("======================================================================")

if __name__ == "__main__":
    run_tests()

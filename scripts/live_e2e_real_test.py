#!/usr/bin/env python3
"""
live_e2e_real_test.py
Comprehensive real live test suite against the deployed ChatGPT Bridge on http://192.168.0.200:8465.

Tests:
1. Single Real Image Generation via POST /image
2. Real Guide Mode Multi-Shot Pipeline (3 camera angle shots) via POST /api/director/execute
3. Real Director Mode Sequence Cancellation via POST /api/director/cancel
"""

import sys
import time
import json
import urllib.request
import urllib.error
from pathlib import Path

BASE_URL = "http://192.168.0.200:8465"
ARTIFACT_DIR = Path("/home/ubuntu/.gemini/antigravity-cli/brain/db75f58e-8edc-4f33-91e8-7bceddf2ad56")

def api_post(endpoint: str, data: dict, timeout: int = 120) -> dict:
    url = f"{BASE_URL}{endpoint}"
    req = urllib.request.Request(
        url,
        data=json.dumps(data).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))

def api_get(endpoint: str, timeout: int = 10) -> dict:
    url = f"{BASE_URL}{endpoint}"
    req = urllib.request.Request(url, method="GET")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))

def download_file(url_path: str, local_path: Path):
    full_url = f"{BASE_URL}{url_path}" if url_path.startswith("/") else url_path
    urllib.request.urlretrieve(full_url, str(local_path))


def test_1_single_image_generation():
    print("\n" + "="*70)
    print("TEST 1: REAL SINGLE IMAGE GENERATION (POST /image)")
    print("="*70)
    
    prompt = "Generate an image: A serene minimalist ceramic coffee mug on a rustic oak table bathed in warm morning sunlight, cinematic lighting, 8k"
    print(f"Prompt: {prompt}")
    
    t0 = time.time()
    resp = api_post("/image", {"prompt": prompt}, timeout=240)
    dur = time.time() - t0
    
    print(f"Response ({dur:.1f}s): {json.dumps(resp, indent=2)}")
    assert resp.get("ok") is True or "image_url" in resp or "url" in resp, f"Failed response: {resp}"
    
    img_url = resp.get("image_url") or resp.get("url")
    assert img_url, f"No image URL returned in response: {resp}"
    
    local_img = ARTIFACT_DIR / "real_test_single_mug.png"
    download_file(img_url, local_img)
    size_kb = local_img.stat().st_size / 1024
    print(f"✓ Downloaded image to {local_img.name} ({size_kb:.1f} KB)")
    assert size_kb > 10, f"Image file is unexpectedly small: {size_kb} KB"
    print(f"✓ TEST 1 PASSED in {dur:.1f}s")
    return resp.get("conversation_id")


def test_2_guide_mode_pipeline(conversation_id: str | None = None):
    print("\n" + "="*70)
    print("TEST 2: REAL GUIDE MODE PIPELINE (2 CAMERA ANGLE SHOTS)")
    print("="*70)
    
    shots = [
        {
            "description": "Eye Level Establishing Shot",
            "camera_pov": "Eye level shot, 50mm lens",
            "prompt": "Generate an image: A vintage turquoise Vespa scooter parked on an old cobblestone street in Rome, eye level shot, 50mm lens, photorealistic"
        },
        {
            "description": "Low Angle Dynamic Shot",
            "camera_pov": "Low angle shot, looking up",
            "prompt": "Generate an image: low angle shot, looking up at the vintage turquoise Vespa scooter with Roman architecture and warm sunflare in background"
        }
    ]
    
    payload = {
        "shots": shots,
        "is_guide_mode": True,
        "conversation_id": conversation_id
    }
    
    print(f"Dispatching Guide Sequence with {len(shots)} shots...")
    exec_resp = api_post("/api/director/execute", payload, timeout=30)
    print("Execution trigger response:", exec_resp)
    assert exec_resp.get("ok") is True
    
    # Poll status until sequence completes
    t0 = time.time()
    last_log = ""
    completed_shots = {}
    
    while time.time() - t0 < 600: # up to 10 min for real generations
        status = api_get("/api/director/status")
        is_running = status.get("is_running")
        curr_shot = status.get("current_shot", 0)
        total_shots = status.get("total_shots", len(shots))
        status_msg = status.get("status_message", "")
        shots_data = status.get("shot_results", [])
        
        log_line = f"[{int(time.time() - t0)}s] Running: {is_running} | Shot {curr_shot}/{total_shots} | Status: {status_msg}"
        if log_line != last_log:
            print(log_line)
            last_log = log_line
            
        for s in shots_data:
            s_idx = s.get("shot_index", 0)
            s_stat = s.get("status")
            s_path = s.get("path") or ""
            fname = s_path.split("/")[-1] if s_path else ""
            if s_stat == "completed" and fname and s_idx not in completed_shots:
                s_img = f"/images/{fname}"
                completed_shots[s_idx] = s_img
                print(f"   ✓ Shot {s_idx} COMPLETED! Image: {s_img}")
                local_shot_img = ARTIFACT_DIR / f"real_test_guide_shot_{s_idx}.png"
                download_file(s_img, local_shot_img)
                print(f"   ✓ Saved shot {s_idx} image ({local_shot_img.stat().st_size / 1024:.1f} KB)")
        
        if not is_running and len(completed_shots) >= len(shots):
            break
        elif not is_running and (status.get("status") == "Complete" or status_msg in ("Cancelled by user", "Error during sequence execution", "Execution finished")):
            break
            
        time.sleep(3)
        
    dur = time.time() - t0
    print(f"✓ Guide shots completed in {dur:.1f}s (completed: {len(completed_shots)}/{len(shots)})!")
    assert len(completed_shots) == len(shots), f"Expected {len(shots)} completed shots, got {len(completed_shots)}"
    print(f"✓ TEST 2 PASSED")


def test_3_director_cancel_live():
    print("\n" + "="*70)
    print("TEST 3: REAL DIRECTOR MODE SEQUENCE CANCELLATION")
    print("="*70)
    
    shots = [
        {
            "description": f"Cyberpunk scene variation {i}",
            "camera_pov": "Cinematic 35mm",
            "prompt": f"Generate an image: Scene variation {i} of a neon cyberpunk street"
        }
        for i in range(5)
    ]
    
    payload = {
        "shots": shots,
        "is_guide_mode": False
    }
    
    print("Dispatching 5-shot sequence...")
    exec_resp = api_post("/api/director/execute", payload, timeout=30)
    assert exec_resp.get("ok") is True
    
    time.sleep(2)
    status_before = api_get("/api/director/status")
    print("Status before cancel:", status_before.get("status_message"), "is_running:", status_before.get("is_running"))
    
    print("Sending cancel request via POST /api/director/cancel...")
    cancel_resp = api_post("/api/director/cancel", {}, timeout=10)
    print("Cancel response:", cancel_resp)
    assert cancel_resp.get("ok") is True
    
    # Verify sequence halts and reports cancelled
    for _ in range(15):
        time.sleep(1)
        status_after = api_get("/api/director/status")
        if not status_after.get("is_running") and "Cancel" in status_after.get("status_message", ""):
            print(f"✓ Director cleanly cancelled: status='{status_after.get('status_message')}', is_running={status_after.get('is_running')}")
            break
    else:
        status_final = api_get("/api/director/status")
        assert not status_final.get("is_running"), f"Director still running after cancel: {status_final}"
        
    print("✓ TEST 3 PASSED")


if __name__ == "__main__":
    print("Starting Live End-to-End Real Test against ChatGPT Bridge at", BASE_URL)
    cid = test_1_single_image_generation()
    test_2_guide_mode_pipeline(conversation_id=cid)
    test_3_director_cancel_live()
    print("\n" + "="*70)
    print("ALL REAL LIVE END-TO-END TESTS COMPLETED SUCCESSFULLY!")
    print("="*70)

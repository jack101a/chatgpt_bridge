#!/usr/bin/env python3
"""Comprehensive live user experience test for both Method 1 (Chatbox Enhancer)
and Method 2 (AI Director Storyboard).

Generates real images via ChatGPT Bridge, captures all prompts and artifacts,
and verifies zero repetitive boilerplate.
"""

import asyncio
import json
import os
import shutil
import time
from pathlib import Path
import httpx
from PIL import Image

BASE_URL = "http://localhost:8466"
ARTIFACT_DIR = Path("/home/ubuntu/.gemini/antigravity-cli/brain/db75f58e-8edc-4f33-91e8-7bceddf2ad56")
BANNED_PHRASE = "Healthy radiant skin with natural dewy warmth and authentic optical depth, completely free of waxy plastic smoothing."

results = {
    "method_1_chatbox": {},
    "method_2_director": {},
}

async def run_method_1(client: httpx.AsyncClient):
    print("\n" + "="*60)
    print("🚀 METHOD 1: CHATBOX ENHANCER -> LIVE IMAGE GENERATION")
    print("="*60)
    
    raw_prompt = "A candid 35mm film photograph of a woman sitting on a wooden dock with her feet in clear mountain lake water at sunrise"
    print(f"\n[1.1 User Input Prompt]:\n{raw_prompt}")
    
    # 1. Enhance via Chatbox Enhancer endpoint
    t0 = time.time()
    enh_res = await client.post(
        f"{BASE_URL}/api/prompt/enhance",
        json={"prompt": raw_prompt, "provider_id": "gemini", "model": "gemini-2.5-flash"},
        timeout=30.0
    )
    enh_data = enh_res.json()
    enh_duration = round(time.time() - t0, 2)
    
    enhanced_prompt = enh_data.get("enhanced_prompt", "")
    model_used = enh_data.get("model_used", "")
    provider_used = enh_data.get("provider_used", "")
    
    print(f"\n[1.2 Enhancer Response] ({enh_duration}s, Model: {provider_used}/{model_used}):")
    print(f"{enhanced_prompt}")
    
    # Verify no canned boilerplate
    assert BANNED_PHRASE not in enhanced_prompt, "Banned boilerplate detected!"
    assert "waxy plastic smoothing" not in enhanced_prompt, "Plastic smoothing phrase detected!"
    words = len(enhanced_prompt.split())
    print(f"Word count: {words} words | Character count: {len(enhanced_prompt)}")
    
    # 2. Live Image Generation via POST /image
    print(f"\n[1.3 Submitting Enhanced Prompt to ChatGPT Live Engine...]")
    t_gen_start = time.time()
    img_res = await client.post(
        f"{BASE_URL}/image",
        json={
            "prompt": enhanced_prompt,
            "conversation_id": None,
            "aspect": "1:1"
        },
        timeout=300.0
    )
    img_data = img_res.json()
    gen_duration = round(time.time() - t_gen_start, 2)
    
    img_path = img_data.get("path")
    conv_id = img_data.get("conversation_id")
    print(f"[1.4 Image Generated]: path={img_path}, conv_id={conv_id} ({gen_duration}s)")
    
    if not img_path or not os.path.exists(img_path):
        raise RuntimeError(f"Generation failed or image not found: {img_data}")
        
    # Copy to artifacts
    dst_name = "live_method1_chatbox_dock_sunrise.png"
    dst_path = ARTIFACT_DIR / dst_name
    shutil.copy2(img_path, dst_path)
    
    # Image inspection
    with Image.open(dst_path) as im:
        width, height = im.size
        img_format = im.format
    file_size_kb = round(os.path.getsize(dst_path) / 1024, 1)
    
    print(f"✅ Method 1 Artifact Saved: {dst_name} ({width}x{height}, {file_size_kb} KB)")
    
    results["method_1_chatbox"] = {
        "raw_prompt": raw_prompt,
        "enhanced_prompt": enhanced_prompt,
        "model_used": f"{provider_used}/{model_used}",
        "enhance_duration_s": enh_duration,
        "word_count": words,
        "generation_duration_s": gen_duration,
        "conversation_id": conv_id,
        "artifact_file": dst_name,
        "dimensions": f"{width}x{height}",
        "file_size_kb": file_size_kb,
    }
    return conv_id


async def run_method_2(client: httpx.AsyncClient):
    print("\n" + "="*60)
    print("🎬 METHOD 2: AI DIRECTOR STORYBOARD -> LIVE MULTI-SHOT SEQUENCE")
    print("="*60)
    
    director_intent = "A skilled watchmaker meticulously restoring an antique mechanical timepiece in his sun-dappled workshop"
    print(f"\n[2.1 Director Story Concept]:\n{director_intent}")
    
    # 1. Plan Storyboard
    t0 = time.time()
    plan_res = await client.post(
        f"{BASE_URL}/api/director/plan",
        json={
            "intent": director_intent,
            "shot_count": 2,
            "aspect_ratio": "16:9"
        },
        timeout=60.0
    )
    plan_data = plan_res.json()
    plan_duration = round(time.time() - t0, 2)
    
    shots = plan_data.get("shots", [])
    print(f"\n[2.2 Director Plan Generated] ({plan_duration}s, {len(shots)} shots):")
    
    shot_details = []
    for idx, s in enumerate(shots, 1):
        prompt = s.get("prompt", "")
        pov = s.get("camera_pov", "")
        desc = s.get("description", "")
        wcount = len(prompt.split())
        print(f"\n--- Shot {idx}: {desc} ({pov}) [{wcount} words] ---")
        print(f"{prompt[:200]}...")
        assert BANNED_PHRASE not in prompt, f"Banned phrase in shot {idx}!"
        assert "waxy plastic smoothing" not in prompt, f"Plastic phrase in shot {idx}!"
        shot_details.append({
            "shot_number": idx,
            "description": desc,
            "camera_pov": pov,
            "prompt": prompt,
            "word_count": wcount,
        })
        
    # Verify shots are distinct
    assert shot_details[0]["prompt"] != shot_details[1]["prompt"], "Shots must not be identical!"
    
    # 2. Execute Shot 1
    print(f"\n[2.3 Executing Shot 1 in fresh conversation thread...]")
    t_s1 = time.time()
    res1 = await client.post(
        f"{BASE_URL}/image",
        json={
            "prompt": shots[0]["prompt"],
            "conversation_id": None,
            "aspect": "16:9"
        },
        timeout=300.0
    )
    data1 = res1.json()
    dur1 = round(time.time() - t_s1, 2)
    path1 = data1.get("path")
    conv_id = data1.get("conversation_id")
    print(f"Shot 1 Complete: {path1} in thread {conv_id} ({dur1}s)")
    
    dst_name1 = "live_method2_shot1_watchmaker.png"
    dst_path1 = ARTIFACT_DIR / dst_name1
    shutil.copy2(path1, dst_path1)
    with Image.open(dst_path1) as im:
        w1, h1 = im.size
    size1_kb = round(os.path.getsize(dst_path1) / 1024, 1)
    print(f"✅ Shot 1 Artifact Saved: {dst_name1} ({w1}x{h1}, {size1_kb} KB)")
    
    # 3. Execute Shot 2 in the SAME conversation thread for visual continuity
    print(f"\n[2.4 Executing Shot 2 in thread {conv_id} (Continuity)...]")
    t_s2 = time.time()
    res2 = await client.post(
        f"{BASE_URL}/image",
        json={
            "prompt": shots[1]["prompt"],
            "conversation_id": conv_id,
            "aspect": "16:9"
        },
        timeout=300.0
    )
    data2 = res2.json()
    dur2 = round(time.time() - t_s2, 2)
    path2 = data2.get("path")
    print(f"Shot 2 Complete: {path2} in thread {conv_id} ({dur2}s)")
    
    dst_name2 = "live_method2_shot2_watchmaker.png"
    dst_path2 = ARTIFACT_DIR / dst_name2
    shutil.copy2(path2, dst_path2)
    with Image.open(dst_path2) as im:
        w2, h2 = im.size
    size2_kb = round(os.path.getsize(dst_path2) / 1024, 1)
    print(f"✅ Shot 2 Artifact Saved: {dst_name2} ({w2}x{h2}, {size2_kb} KB)")
    
    results["method_2_director"] = {
        "intent": director_intent,
        "plan_duration_s": plan_duration,
        "conversation_id": conv_id,
        "shot_1": {
            **shot_details[0],
            "generation_duration_s": dur1,
            "artifact_file": dst_name1,
            "dimensions": f"{w1}x{h1}",
            "file_size_kb": size1_kb,
        },
        "shot_2": {
            **shot_details[1],
            "generation_duration_s": dur2,
            "artifact_file": dst_name2,
            "dimensions": f"{w2}x{h2}",
            "file_size_kb": size2_kb,
        }
    }


async def main():
    async with httpx.AsyncClient(timeout=360.0) as client:
        # Check health
        h = await client.get(f"{BASE_URL}/health")
        assert h.status_code == 200, "Daemon is not healthy!"
        
        await run_method_1(client)
        await run_method_2(client)
        
        # Save JSON results log
        with open("/tmp/live_user_experience_results.json", "w") as f:
            json.dump(results, f, indent=2)
            
        print("\n" + "="*60)
        print("🎉 ALL LIVE GENERATION TESTS COMPLETED SUCCESSFULLY!")
        print("="*60)

if __name__ == "__main__":
    asyncio.run(main())

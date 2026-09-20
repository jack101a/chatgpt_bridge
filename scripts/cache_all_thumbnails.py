#!/usr/bin/env python3
"""
cache_all_thumbnails.py
Concurrently downloads and compresses all 1,003 full images from GitHub
into local WebP thumbnails (max 480x480, 80% quality) in python/chatgpt_bridge/data/thumbnails/.
"""

import asyncio
import io
import json
from pathlib import Path
from PIL import Image
import httpx

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_FILE = BASE_DIR / "python" / "chatgpt_bridge" / "data" / "curated_prompts.json"
THUMB_DIR = BASE_DIR / "python" / "chatgpt_bridge" / "data" / "thumbnails"
THUMB_DIR.mkdir(parents=True, exist_ok=True)

CONCURRENCY = 16
TIMEOUT = 12.0

async def process_prompt(sem: asyncio.Semaphore, client: httpx.AsyncClient, p: dict, stats: dict):
    pid = p["id"]
    out_file = THUMB_DIR / f"{pid}.webp"

    if out_file.exists() and out_file.stat().st_size > 0:
        stats["skipped"] += 1
        return True

    url = p.get("full_image")
    if not url:
        stats["failed"] += 1
        return False

    async with sem:
        try:
            resp = await client.get(url, timeout=TIMEOUT)
            if resp.status_code != 200:
                stats["failed"] += 1
                return False

            img = Image.open(io.BytesIO(resp.content))
            if img.mode not in ("RGB", "RGBA"):
                img = img.convert("RGB")

            img.thumbnail((480, 480), Image.Resampling.LANCZOS)
            buf = io.BytesIO()
            img.save(buf, format="WEBP", quality=80)
            out_file.write_bytes(buf.getvalue())
            stats["downloaded"] += 1
            return True
        except Exception:
            stats["failed"] += 1
            return False

async def main():
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        prompts = json.load(f)["prompts"]

    total = len(prompts)
    print(f"Starting thumbnail caching for {total} prompts with concurrency {CONCURRENCY}...")

    stats = {"downloaded": 0, "skipped": 0, "failed": 0}
    sem = asyncio.Semaphore(CONCURRENCY)

    limits = httpx.Limits(max_keepalive_connections=CONCURRENCY, max_connections=CONCURRENCY * 2)
    async with httpx.AsyncClient(limits=limits, headers={"User-Agent": "Mozilla/5.0"}) as client:
        tasks = [process_prompt(sem, client, p, stats) for p in prompts]
        
        # Report progress periodically
        for fut in asyncio.as_completed(tasks):
            await fut
            done = stats["downloaded"] + stats["skipped"] + stats["failed"]
            if done % 100 == 0 or done == total:
                print(f"Progress: {done}/{total} (New: {stats['downloaded']}, Cached: {stats['skipped']}, Failed: {stats['failed']})")

    total_size_mb = sum(f.stat().st_size for f in THUMB_DIR.glob("*.webp")) / (1024 * 1024)
    print(f"\nCompleted thumbnail caching!")
    print(f"Total files in {THUMB_DIR}: {len(list(THUMB_DIR.glob('*.webp')))}")
    print(f"Total disk usage: {total_size_mb:.2f} MB")

if __name__ == "__main__":
    asyncio.run(main())

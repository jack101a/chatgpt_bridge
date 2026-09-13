"""Ask Kimi k3 to design a production-grade UI/UX Web Dashboard for ChatGPT Bridge."""

from __future__ import annotations

import asyncio
import json
import os
import sys
from pathlib import Path

import httpx
from dotenv import load_dotenv

load_dotenv("/home/ubuntu/projects/xbot/backend/.env")

prompt = """
You are Kimi k3, an elite Principal Full-Stack Architect, UI/UX Design Technologist, and Systems Engineer.

We have built a production-grade, highly reliable autonomous bridge for ChatGPT (`chatgpt_bridge`), running in Docker/Linux, driving headless/headed Chromium via Playwright, supporting automated image generation (DALL-E), text chats, and a Telegram Bot interface (`@Amulstocknotify_bot`).

We recently upgraded the core engine with 4 industry-grade capabilities:
1. In-Page Authenticated Blob Fetch (images downloaded directly from browser memory via `fetch` with `credentials: include` + `FileReader` base64 decoding, preventing CDN 403s).
2. Fast Rate-Limit Dialog Detection (<1s bail on `[role="dialog"]` rate limit modals instead of 180s timeout).
3. Core Multi-Account Engine Auto-Switching (proactive pre-flight rotation & reactive mid-flight failover across account pools).
4. ChatGPT Project / Folder Isolation (automatically organizing bot conversations in a dedicated project folder).

---

### OUR CURRENT SYSTEM ARCHITECTURE & STATE

1. **Backend Server (`chatgpt_bridge/daemon.py`)**:
   - Python 3.11, FastAPI serving on port `8465`.
   - Threading & Async: A central `_lock = asyncio.Lock()` coordinates access to a single `ChatGPT` core engine instance.
   - Current Endpoints:
     * `GET /health` -> `{"status": "ok", "uptime_s": ...}`
     * `GET /images/{filename}` -> Streams saved PNG from disk
     * `GET /accounts` -> Lists all configured accounts, active status, cooldown epoch timestamps, total generations, strikes.
     * `POST /accounts/switch` -> Swaps active account (`{"account": "Ajax1001"}`)
     * `POST /image` -> Submits generation prompt with optional `tweaked_prompt`, `tweaked_prompt_2`, `conversation_id`, and `timeout_s`. Returns `{"path", "conversation_id", "prompt", "account_used", "switched_from"}`.
     * `POST /ask` -> Submits standard text prompt. Returns `{"text", "conversation_id"}`.
     * `DELETE /conversations/{id}` -> Deletes conversation from ChatGPT backend.

2. **Persistent Storage & File Layout (`/data` or `~/.chatgpt-bridge/`)**:
   - `accounts.json`: JSON ledger storing all accounts (`id`, `alias`, `email`, `profile_dir`, `cookies_file`, `is_authenticated`, `total_generations`, `consecutive_rate_limits`, `rate_limited_until`, `rate_limit_resets_at_str`).
   - `chat_pool.json`: `{"_ids": ["6aa6dca7-...", ...]}` tracking currently active conversations.
   - `images/`: Stores all generated images named `<epoch_timestamp_ms>.png`.
   - `delivered_ids.json`: Sorted list of file IDs to avoid returning duplicate images.
   - `cookies.json`: Cookie exports for session restoration.

3. **Telegram Bot (`chatgpt_bridge/bot.py`)**:
   - Runs concurrently in the same process/container, polling Telegram Bot API.
   - Used as a mobile "pocket remote" to generate images on-the-go.

---

### OUR GOAL: A LIGHTWEIGHT, COMPANION WEB UI / UX DASHBOARD

While Telegram is fantastic for on-the-go mobile triggering, chat bubbles make it tedious to browse dozens of past generations, compare prompt variations, check multi-account rate limit health, or inspect conversation continuity turns.

We want to design a **gorgeous, lightning-fast, zero-overhead Web Dashboard** that runs directly alongside the Telegram bot in the same container, served by FastAPI on port `8465` (at `GET /` or `GET /dashboard`).

#### CRITICAL CONSTRAINTS:
1. **Zero Extra Containers / Zero Extra RAM**:
   - MUST NOT require a separate Node.js / Next.js service or heavy build pipeline.
   - It should be served directly by FastAPI as a clean Single-Page Application (SPA) using vanilla modern ES6 / Alpine.js / Tailwind CSS (via CDN) with zero build step, consuming <10MB of RAM.
2. **Design Language & Aesthetics**:
   - High-end Dark Theme inspired by Linear.app, Vercel, Midjourney, and ComfyUI.
   - Deep rich neutrals (`#09090b` / `#121214` / `#18181b`), subtle hairline borders (`border-zinc-800`), luminous accents (indigo/violet `#6366f1` or emerald `#10b981`), crisp typography (Inter/Geist), glassmorphic backdrops, smooth transitions.
   - Mobile and desktop responsive.

---

### REQUIRED DASHBOARD CAPABILITIES / MODULES

1. **Module 1: Visual Masonry Gallery & Inspection Lightbox**:
   - Infinite scroll / masonry grid displaying all generated images from `images/`.
   - Quick filters: "All Generations", "By Conversation / Character" (grouping turns of a character together), "Latest (Today)", "Favorites".
   - Fullscreen Lightbox / Inspector:
     * High-res image view with zoom/pan.
     * Metadata drawer: Prompt used, Level 1 / Level 2 tweaks used, Account used, Conversation ID, Generation duration, File size, MD5 checksum.
     * Action Bar: "Copy Prompt", "Continue this Chat (New Turn)", "Download PNG", "Delete".

2. **Module 2: Multi-Account Command & Health Center**:
   - Visual status cards for all accounts in `accounts.json` (`Primary`, `Ajax1001`, etc.).
   - Live status indicators: `🟢 Active & Healthy`, `⏳ Cooling Down (Resets in XXm)`, `⚪ Standby`.
   - One-click "Switch Active Account" button.
   - "Add Account / Update Cookies" slide-over drawer (paste JSON cookies or upload `cookies.json`).

3. **Module 3: Chat Pool & Session Continuity Manager**:
   - Visual table/cards of active conversation IDs from `chat_pool.json`.
   - Shows turn count, thumbnail previews of images generated in that chat, last active timestamp.
   - 1-click "Clear Stale Chats" and "Delete Chat".

4. **Module 4: Desktop Prompt Studio (Interactive Playground)**:
   - Modern prompt composer with keyboard shortcut (`Cmd/Ctrl + Enter` to submit).
   - Collapsible 2-tier prompt tweaking fields (Level 1 softening & Level 2 refinement).
   - Dropdown to attach generation to an existing conversation (continuity) or start a fresh chat.
   - Real-time generation overlay / progress indicator showing DALL-E generation timer, retry index (e.g. `Retry 2/10`), and live status.

5. **Module 5: System Telemetry & Quick Toggles**:
   - Live stats: Engine status, browser activity, total images generated, active account.
   - Toggles for `auto_switch` (on/off), `max_retries` (default 10).

---

### YOUR TASK & DELIVERABLES

Please provide an exhaustive, production-grade architectural and implementation blueprint:

1. **System & Information Architecture**:
   - Layout wireframes & navigation structure.
   - Component hierarchy and state management approach for the SPA.

2. **Backend API Extension Specification**:
   - Detail the exact additional REST endpoints needed in `daemon.py` (e.g. `GET /api/gallery` with pagination/metadata, `GET /api/chats`, `POST /api/accounts/cookies`, etc.) with Pydantic request/response models.

3. **Complete, Production-Ready Single-Page Application (`dashboard.html`)**:
   - Provide the complete, polished HTML + Tailwind CSS (via CDN) + Alpine.js / Vanilla JS implementation.
   - Include the interactive gallery, lightbox, account switcher, chat pool manager, and prompt studio.
   - Ensure clean code, error handling, toasts, and loading states.

4. **FastAPI Integration Code**:
   - Show exactly how `daemon.py` mounts and serves this dashboard (e.g. `HTMLResponse` or `StaticFiles`).

Deliver a comprehensive, breathtaking, and immediately deployable solution!
"""

async def main():
    base_url = os.getenv("LITELLM_BASE_URL", "https://llm.002529.xyz/v1").rstrip("/")
    api_key = os.getenv("LITELLM_API_KEY", "")
    if not api_key:
        print("ERROR: LITELLM_API_KEY is not set!")
        sys.exit(1)

    url = f"{base_url}/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": "kimi-k3",
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.7,
        "max_tokens": 16000,
        "stream": True,
    }

    timeout = httpx.Timeout(1800.0, connect=120.0, read=1800.0, write=120.0)
    print("Connecting to Kimi K3 (30-minute keep-alive streaming timeout)...")

    full_content = []
    reasoning_content = []

    async with httpx.AsyncClient(timeout=timeout) as client:
        async with client.stream("POST", url, headers=headers, json=payload) as response:
            print(f"HTTP Status: {response.status_code}")
            if response.status_code != 200:
                body = await response.aread()
                print(f"Error body: {body.decode()}")
                return

            print("\n=== STREAMING FROM KIMI K3 ===\n")
            async for line in response.aiter_lines():
                if not line or not line.startswith("data: "):
                    continue
                data_str = line[6:].strip()
                if data_str == "[DONE]":
                    break
                try:
                    chunk = json.loads(data_str)
                    choices = chunk.get("choices", [])
                    if choices:
                        delta = choices[0].get("delta", {})

                        # Reasoning tokens
                        r_token = delta.get("reasoning_content")
                        if r_token:
                            reasoning_content.append(r_token)
                            print(r_token, end="", flush=True)

                        # Standard content tokens
                        c_token = delta.get("content")
                        if c_token:
                            full_content.append(c_token)
                            print(c_token, end="", flush=True)
                except Exception:
                    pass

    final_output = "".join(full_content) if full_content else "".join(reasoning_content)
    print("\n\n=== DESIGN SPEC COMPLETE ===\n")

    output_path = Path("docs/KIMI_DASHBOARD_UIUX_SPEC.md")
    output_path.write_text(final_output, encoding="utf-8")
    print(f"Saved complete specification to {output_path.absolute()}")


if __name__ == "__main__":
    asyncio.run(main())

import asyncio
import json
import os
import sys
import httpx
from dotenv import load_dotenv
load_dotenv("/home/ubuntu/projects/xbot/backend/.env")

prompt = """
You are Kimi k3, an expert Software Architect and Project Orchestrator.
Earlier, you authored the "XBOT ARCHITECTURE REBUILD — MASTER EXECUTION BLUEPRINT" defining a strict Ports & Adapters (Hexagonal Architecture) / Modular Monolith migration plan for our AI automation bot (XBot Pro).

Here is the comprehensive report of our FULL EXECUTION of your blueprint:

### 1. PHASE 0 — SAFETY SCAFFOLDING & BOUNDARY ENFORCEMENT
- We implemented `backend/scripts/lint_boundaries.py` which performs AST parsing over the entire repository.
- It strictly enforces that:
  * NO module outside `xbot.infra.browser` or `xbot.infra.llm.chatgpt_bridge` may import `playwright` or raw browser drivers.
  * NO pipeline, task, contract, or domain module has low-level browser driver leakage.
- Linter status: PASSES with 0 violations (`✅ Architectural Boundary Lint Passed`).

### 2. PHASE 1 — THE CONTRACTS LAYER (`xbot/contracts/`)
- `xbot/contracts/browser.py`: Implements `BrowserActionType` enum, `BrowserRequest` envelope, and normalized Pydantic DTOs: `TweetData`, `NotificationData`, `FollowListResult`, `ScrapeResult`, `ActionResult`, `BrowserResponse`.
- `xbot/contracts/ports.py`: Implements abstract base classes `BrowserPort`, `LLMPort`, `GuardPort`.
- `xbot/contracts/pipeline.py`: Implements `PipelineResult` standardized telemetry model.

### 3. PHASE 2 — INFRASTRUCTURE ADAPTERS & COMPOSITION ROOT (`xbot/infra/` & `container.py`)
- `xbot/infra/browser/adapter.py`: Implements `PlaywrightBrowserAdapter(BrowserPort)` for synchronous/direct Playwright execution.
- `xbot/infra/browser/queued_adapter.py`: Implements `QueuedBrowserAdapter(BrowserPort)` for asynchronous Redis queue execution.
- `xbot/infra/browser/interactive_login.py`: Quarantined headed browser login session helper.
- `xbot/infra/browser/queue/worker.py`: Quarantined browser queue consumer and action routing engine.
- `xbot/infra/llm/adapter.py`: Implements `UnifiedLLMAdapter(LLMPort)`.
- `xbot/infra/guard/adapter.py`: Implements `CentralGuardAdapter(GuardPort)`.
- `xbot/container.py`: Central Composition Root DI Container (`Container`, `get_container()`, `reset_container()`). Supports full dependency injection and clean mock overriding in tests.

### 4. PHASE 3 — FULL PIPELINE REFACTORING & DECOUPLING (`xbot/pipelines/`)
Every single application pipeline was refactored to eliminate raw Playwright Page objects and BrowserManager direct calls, operating exclusively through `container.browser.execute(BrowserRequest(...))` and `container.guard.can_act(...)`:
1. `like_pipeline.py` (Dispatches `BrowserActionType.LIKE`)
2. `quote_pipeline.py` (Dispatches `BrowserActionType.SCRAPE_FEED` and `BrowserActionType.QUOTE`)
3. `notification_engagement_pipeline.py` (Dispatches `BrowserActionType.SCRAPE_NOTIFICATIONS`, `LIKE`, `REPLY`)
4. `follow_pipeline.py` (Dispatches `BrowserActionType.SCRAPE_FOLLOW_LIST`, `FOLLOW`, `UNFOLLOW`)
5. `follow_growth_post_pipeline.py` (Dispatches `BrowserActionType.POST`)
6. `post_pruner_pipeline.py` (Dispatches `BrowserActionType.SCRAPE_PROFILE_TWEETS`, `DELETE_TWEET`)
7. `reply_pipeline/` (`pipeline.py`, `kol_sniper.py`, `generator.py`) (Dispatches `BrowserActionType.CHECK_USER_LATEST`, `REPLY`, `SCRAPE_FEED`, `LIKE`)
8. `trend_researcher_pipeline.py` (Dispatches `BrowserActionType.SCRAPE_TRENDING`, `SCRAPE_FEED`)
9. `trend_generator_pipeline/` (Dispatches `BrowserActionType.POLL`, `THREAD`, `POST`)
10. `on_demand_campaign_pipeline/` (Dispatches `BrowserActionType.POLL`, `THREAD`, `POST`)

### 5. PHASE 4 — AI & DRIVER MIGRATION
- Quarantined `chatgpt_bridge` web scraping driver from `xbot/ai/` into `xbot/infra/llm/chatgpt_bridge/` (leaving a backward-compatible facade at `xbot/ai/chatgpt_bridge/__init__.py`).
- Refactored `xbot/ai/x_researcher/crawler.py` to route deep search queries through `BrowserPort` (`BrowserActionType.SEARCH`).

### 6. PHASE 5 — MODULARITY & TEST VERIFICATION
- All files across tasks, api routers, AI modules, and UI slices refactored into modular subpackages strictly under 250-300 lines of code.
- 100% of tests passing (169 tests across contracts, adapters, pipelines, and mock browser integration suites).
- Live daemons (FastAPI `:8200`, Next.js `:3002`, Celery Beat/Worker) healthy and online.

---

### YOUR EVALUATION TASK:
Please evaluate this execution against your original architectural vision:
1. Did we succeed with the Ports & Adapters migration plan?
2. Are all architectural boundaries and invariants properly preserved?
3. Is anything different from or missing compared to your original blueprint, or any future architectural recommendations you would give us?
"""

async def main():
    base_url = os.getenv("LITELLM_BASE_URL", "https://llm.002529.xyz/v1").rstrip("/")
    api_key = os.getenv("LITELLM_API_KEY", "sk-y_2_lD1m4Ojw1QFMDEWgwA")
    url = f"{base_url}/chat/completions"
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "kimi-k3",
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.7,
        "max_tokens": 16000,
        "stream": True
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
    print("\n\n=== EVALUATION COMPLETE ===\n")
    
    with open("/home/ubuntu/projects/xbot/backend/kimi_verification_result.md", "w") as f:
        f.write(final_output)
    print("Saved evaluation to /home/ubuntu/projects/xbot/backend/kimi_verification_result.md")

if __name__ == "__main__":
    asyncio.run(main())

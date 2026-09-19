# ChatGPT Images 2.5 Prompting Integration Plan

## Goal
Integrate the official OpenAI ChatGPT Images 2.5 / GPT-Image-2.5 prompt architecture (7-layer semantic hierarchy, compact ~160–240 word density, positive scene assertions, and Multi-Turn Stability & Delta protocol) across backend (`director.py`, `sanitizer.py`) and frontend (`promptEnhancer.ts`, `DirectorModal.tsx`).

## Tasks
- [x] Task 1: Replace legacy 1,000-word benchmark in `python/chatgpt_bridge/director.py` with the ChatGPT 2.5 7-layer gold standard (~200 words) and update `DIRECTOR_SHOT_SYSTEM_PROMPT` → Verify: `grep -i "intentionally unpredictable" python/chatgpt_bridge/director.py` returns 0 matches.
- [x] Task 2: Implement Multi-Turn Stability & Delta Protocol in `_synthesize_master_prompt_fallback` and `_expand_single_shot` for recurring character turns (Turn 1..N: `Keep [likeness/DNA] stable, change [camera/action] to...`) → Verify: Character lock storyboard tests produce stability & delta phrasing for shots > 0.
- [x] Task 3: Modernize `python/chatgpt_bridge/sanitizer.py` to refine `ANTI_PLASTIC_CLAUSE` with dewy radiant positive assertions and remove legacy DALL-E 3 references → Verify: `pytest python/tests/test_images.py` and sanitizer unit checks pass.
- [x] Task 4: Upgrade frontend `frontend/src/lib/promptEnhancer.ts` to output clean 1–3 sentence or 7-layer compact prompts without buzzword spam or negative lectures → Verify: Run `npm run build` in `frontend/` without errors.
- [x] Task 5: Enhance `frontend/src/components/director/DirectorModal.tsx` with 7-layer shot preview chips (Framing, Action, Lighting) and updated 2.5 guidance chips → Verify: Vite HMR compiles cleanly and modal renders shot breakdowns.
- [x] Task 6: Update unit test suite in `python/tests/test_director.py` to validate 7-layer compliance, 150–250 word density, and stability & delta syntax → Verify: `python/.venv/bin/pytest python/tests/test_director.py` passes 100%.
- [x] Task 7: Live end-to-end verification via Bridge Daemon on port 8466 → Verify: Storyboard generates clean, diverse shots without face lock or repetitive framing.

## Done When
- [x] All 8+ unit tests in `python/tests/test_director.py` pass (9/9 passed).
- [x] Frontend builds cleanly with zero TypeScript errors (`tsc -b && vite build` passed).
- [x] Prompt density remains strictly 150–250 words per shot (no 1,000-word dumps).
- [x] Multi-turn character consistency leverages the native 2.5 Stability & Delta protocol.

## ✅ PHASE X COMPLETE
- Python Unit Tests: ✅ 260/260 Pass (`pytest python/tests`)
- Director Tests: ✅ 9/9 Pass (`pytest python/tests/test_director.py`)
- Frontend Build: ✅ Success (`npm --prefix frontend run build`)
- Daemon API Live Verification: ✅ Pass (Freeform & Character Lock tested on port 8466)
- Date: 2026-09-19

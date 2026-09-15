# AI Director, Character Studio & Storyboard Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete AI Director and Character Studio system enabling OpenAI-compatible LLM prompting, character appearance locking (Visual DNA + Wardrobes), prompt library modifiers, and automated multi-shot storyboard generation dispatched turn-by-turn to ChatGPT.

**Architecture:** A modular Python backend using async `httpx` to interface with any OpenAI-compatible LLM, managing characters in `characters.json`, synthesizing deterministic DALL-E 3 prompts with conversational thread continuity, and exposing a mobile-first React frontend with Character Drawer, Prompt Library chips, and an editable Storyboard Sequence Tray.

**Tech Stack:** Python 3.11, FastAPI, httpx, Pydantic v2, pytest, React 18, TypeScript, Tailwind CSS, Lucide React, Vite.

**Spec:** Described in conversation history and blueprint (Tavern-style Visual DNA, Hybrid Storyboard Queue with Auto-Execute toggle, Backend Proxy via Daemon).

## Global Constraints
- Do not introduce heavy extra external SDKs (use existing `httpx` for OpenAI-compatible HTTP requests).
- Preserve existing ChatGPT automation, telegram storage vault, and daemon endpoints without regression.
- Follow `DESIGN.md` tokens for all new frontend components (dark/light theme support, 60fps mobile responsiveness, no forbidden colors).
- Maintain 100% test pass rate across all existing 41 backend tests.

---

### Task 1: OpenAI-Compatible Client (`llm_client.py`) & Settings Endpoints

**Files:**
- Create: `python/chatgpt_bridge/llm_client.py`
- Modify: `python/chatgpt_bridge/daemon.py`
- Test: `python/tests/test_llm_client.py`

**Interfaces:**
- Produces: `OpenAICompatibleClient` with `test_connection(base_url, api_key) -> Tuple[bool, str, List[str]]` and `chat_completion(base_url, api_key, model, messages, json_mode) -> str`.
- Endpoints: `GET /api/llm/config`, `POST /api/llm/config`, `POST /api/llm/test`.

- [ ] **Step 1: Write failing tests for `OpenAICompatibleClient`**
Create `python/tests/test_llm_client.py` testing successful connection, invalid key/401 handling, timeout handling, and JSON chat completion using mock HTTP transports.

- [ ] **Step 2: Run test to verify failure**
Run: `python/.venv/bin/pytest python/tests/test_llm_client.py -v`
Expected: FAIL with ModuleNotFoundError or import error.

- [ ] **Step 3: Implement `OpenAICompatibleClient` in `python/chatgpt_bridge/llm_client.py`**
Implement async methods using `httpx.AsyncClient`:
  - `test_connection(base_url, api_key)`: calls `GET {base_url}/models` and measures latency.
  - `chat_completion(base_url, api_key, model, messages, temperature, json_mode)`: calls `POST {base_url}/chat/completions`.
  - Robust regex JSON extraction if JSON parse fails.

- [ ] **Step 4: Add LLM configuration endpoints to `daemon.py`**
Add:
  - `GET /api/llm/config`: returns current config with masked key.
  - `POST /api/llm/config`: updates `settings.json` (`llm_base_url`, `llm_api_key`, `llm_model`).
  - `POST /api/llm/test`: validates provided or stored credentials.

- [ ] **Step 5: Run tests to verify passing**
Run: `python/.venv/bin/pytest python/tests/test_llm_client.py -v`
Expected: PASS (all tests green).

- [ ] **Step 6: Commit**
```bash
git add python/chatgpt_bridge/llm_client.py python/chatgpt_bridge/daemon.py python/tests/test_llm_client.py
git commit -m "feat(llm): add OpenAI-compatible client and configuration endpoints"
```

---

### Task 2: Character Studio Storage Engine (`characters.py`) & Lock API

**Files:**
- Create: `python/chatgpt_bridge/characters.py`
- Modify: `python/chatgpt_bridge/daemon.py`
- Test: `python/tests/test_characters.py`

**Interfaces:**
- Produces: `CharacterManager` with CRUD methods for `CharacterCard` (Visual DNA, Persona, Style Anchor, Wardrobes) and `set_active_character(id)`.
- Endpoints: `GET /api/characters`, `POST /api/characters`, `PUT /api/characters/{id}`, `DELETE /api/characters/{id}`, `POST /api/characters/{id}/lock`.

- [x] **Step 1: Write failing tests for `CharacterManager`**
Create `python/tests/test_characters.py` testing creation, validation of Visual DNA, wardrobe management, active lock persistence, and deletion.

- [x] **Step 2: Run test to verify failure**
Run: `python/.venv/bin/pytest python/tests/test_characters.py -v`
Expected: FAIL.

- [x] **Step 3: Implement `CharacterManager` in `python/chatgpt_bridge/characters.py`**
Define Pydantic models: `WardrobeItem`, `CharacterCard`, `CharacterListResponse`.
Store state atomically in `~/.chatgpt-bridge/characters.json` with file locking.

- [x] **Step 4: Integrate Character endpoints into `daemon.py`**
Mount `GET /api/characters`, `POST /api/characters`, `PUT /api/characters/{id}`, `DELETE /api/characters/{id}`, `POST /api/characters/{id}/lock` (toggle lock).

- [x] **Step 5: Run tests to verify passing**
Run: `python/.venv/bin/pytest python/tests/test_characters.py -v`
Expected: PASS.

- [x] **Step 6: Commit**
```bash
git add python/chatgpt_bridge/characters.py python/chatgpt_bridge/daemon.py python/tests/test_characters.py
git commit -m "feat(characters): add Character Studio storage and active lock API"
```

---

### Task 3: Prompt Library Catalog & Custom Presets (`prompt_library.py`)

**Files:**
- Create: `python/chatgpt_bridge/prompt_library.py`
- Modify: `python/chatgpt_bridge/daemon.py`
- Test: `python/tests/test_prompt_library.py`

**Interfaces:**
- Produces: `get_prompt_library()` returning built-in categories (Camera Angles, Lighting, Film & Aesthetics, Environments) merged with user custom presets from `~/.chatgpt-bridge/user_presets.json`.
- Endpoints: `GET /api/prompt-library`, `POST /api/prompt-library/custom`, `DELETE /api/prompt-library/custom/{id}`.

- [ ] **Step 1: Write failing tests for `prompt_library.py`**
Test retrieving standard categories, saving user custom chips, and deleting chips.

- [ ] **Step 2: Run test to verify failure**
Run: `python/.venv/bin/pytest python/tests/test_prompt_library.py -v`
Expected: FAIL.

- [ ] **Step 3: Implement `prompt_library.py`**
Provide rich built-in catalog for camera angles (Front, 3/4, Profile, Back POV, etc.), lighting, and film styles, plus custom preset CRUD.

- [ ] **Step 4: Mount endpoints in `daemon.py`**
Add `GET /api/prompt-library`, `POST /api/prompt-library/custom`, and `DELETE /api/prompt-library/custom/{id}`.

- [ ] **Step 5: Run tests to verify passing**
Run: `python/.venv/bin/pytest python/tests/test_prompt_library.py -v`
Expected: PASS.

- [ ] **Step 6: Commit**
```bash
git add python/chatgpt_bridge/prompt_library.py python/chatgpt_bridge/daemon.py python/tests/test_prompt_library.py
git commit -m "feat(prompt-library): add curated visual modifiers and user preset engine"
```

---

### Task 4: AI Director Storyboard Planner (`director.py`)

**Files:**
- Create: `python/chatgpt_bridge/director.py`
- Modify: `python/chatgpt_bridge/daemon.py`
- Test: `python/tests/test_director.py`

**Interfaces:**
- Produces: `DirectorEngine.plan_storyboard(intent, character, shot_count, style_override) -> StoryboardPlan`.
- Endpoints: `POST /api/director/plan`.

- [ ] **Step 1: Write failing tests for `DirectorEngine`**
Create `python/tests/test_director.py` mocking LLM responses to test prompt synthesis with Character Visual DNA, wardrobe injection, shot count parsing, and fallback JSON repair.

- [ ] **Step 2: Run test to verify failure**
Run: `python/.venv/bin/pytest python/tests/test_director.py -v`
Expected: FAIL.

- [ ] **Step 3: Implement `DirectorEngine` in `python/chatgpt_bridge/director.py`**
Implement the Director system prompt enforcing the Deterministic Anchor Formula:
`[Style] + [Visual DNA] + [Wardrobe] + [Camera POV] + [Action/Environment] + [Lighting]`.
Include robust Pydantic parsing of `StoryboardPlan` and `StoryboardShot`.

- [ ] **Step 4: Mount `POST /api/director/plan` in `daemon.py`**
Connect endpoint to `DirectorEngine`, reading active character automatically if not explicitly provided.

- [ ] **Step 5: Run tests to verify passing**
Run: `python/.venv/bin/pytest python/tests/test_director.py -v`
Expected: PASS.

- [ ] **Step 6: Commit**
```bash
git add python/chatgpt_bridge/director.py python/chatgpt_bridge/daemon.py python/tests/test_director.py
git commit -m "feat(director): add AI storyboard planning engine with character anchor formula"
```

---

### Task 5: Storyboard Sequence Execution Engine in Daemon

**Files:**
- Modify: `python/chatgpt_bridge/daemon.py`
- Test: `python/tests/test_director_execution.py`

**Interfaces:**
- Endpoints: `POST /api/director/execute` and WebSocket broadcast event `director_sequence_progress`.
- Produces: Sequential dispatch of shots to `ui_driver.ask()`, tagging resulting images in `gallery_index.json` with `sequence_id`, `character_id`, and `shot_index`.

- [ ] **Step 1: Write failing test for sequence execution**
Create `python/tests/test_director_execution.py` verifying sequential dispatch, progress event emission, rate-limit backoff delay, and gallery metadata tagging.

- [ ] **Step 2: Run test to verify failure**
Run: `python/.venv/bin/pytest python/tests/test_director_execution.py -v`
Expected: FAIL.

- [ ] **Step 3: Implement sequence execution loop in `daemon.py`**
Implement background async task for sequence execution:
  - Reuse conversation ID across shots to preserve ChatGPT visual continuity.
  - Apply 8-12s pacing.
  - Tag gallery records with `sequence_id` and `character_id`.
  - Broadcast live WebSocket updates.

- [ ] **Step 4: Run tests to verify passing**
Run: `python/.venv/bin/pytest python/tests/test_director_execution.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add python/chatgpt_bridge/daemon.py python/tests/test_director_execution.py
git commit -m "feat(director): add background sequence execution engine with same-thread continuity"
```

---

### Task 6: Frontend - AI Director Settings & Provider Presets

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/components/settings/AccountsDrawer.tsx`

**Interfaces:**
- Consumes: `/api/llm/config`, `/api/llm/test`.
- Renders: AI Director configuration section with preset buttons (`OpenAI`, `OpenRouter`, `DeepSeek`, `Groq`, `Ollama`), inputs for Base URL, API Key, Model, and a live Test Connection badge.

- [ ] **Step 1: Add LLM types and API methods in `types.ts` and `api.ts`**
Add `LLMConfig`, `LLMTestResult` types, and `getLLMConfig()`, `saveLLMConfig()`, `testLLMConnection()` API helpers.

- [ ] **Step 2: Add AI Director section to `AccountsDrawer.tsx`**
Render provider preset buttons, masked key input, test connection button, and latency display.

- [ ] **Step 3: Verify frontend compilation**
Run: `npm run build` in `frontend/`
Expected: PASS.

- [ ] **Step 4: Commit**
```bash
git add frontend/src/types.ts frontend/src/lib/api.ts frontend/src/components/settings/AccountsDrawer.tsx
git commit -m "feat(ui): add AI Director configuration and provider presets to settings drawer"
```

---

### Task 7: Frontend - Character Studio Drawer & Lock Indicator

**Files:**
- Create: `frontend/src/components/character/CharacterStudioDrawer.tsx`
- Modify: `frontend/src/components/navigation/DesktopSidebar.tsx`
- Modify: `frontend/src/components/navigation/MobileBottomNav.tsx`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: `/api/characters`, `/api/characters/{id}/lock`.
- Renders: Character list, Visual DNA editor, Wardrobe selector, Lock status toggle, and active character banner in top nav.

- [ ] **Step 1: Add Character types and API client functions**
In `types.ts` and `api.ts`, add `CharacterCard`, `WardrobeItem`, `getCharacters()`, `saveCharacter()`, `lockCharacter()`.

- [ ] **Step 2: Build `CharacterStudioDrawer.tsx`**
Implement modal/drawer with:
  - Character list & `+ New Character` button.
  - Visual DNA input with helper tips.
  - Persona & Roleplay description.
  - Wardrobes list (add/switch active outfit).
  - Prominent `[🔒 Lock Character]` toggle.

- [ ] **Step 3: Integrate into App navigation & header**
Add Character icon to desktop sidebar & mobile nav, plus active character lock pill in top header bar.

- [ ] **Step 4: Verify frontend compilation**
Run: `npm run build` in `frontend/`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add frontend/src/components/character/CharacterStudioDrawer.tsx frontend/src/App.tsx frontend/src/components/navigation/
git commit -m "feat(ui): add Character Studio drawer, visual DNA editor, and lock indicator"
```

---

### Task 8: Frontend - Storyboard Generator & Sequence Tray

**Files:**
- Create: `frontend/src/components/director/StoryboardTray.tsx`
- Create: `frontend/src/components/director/PromptLibraryTray.tsx`
- Modify: `frontend/src/components/chat/Composer.tsx`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: `/api/director/plan`, `/api/director/execute`, `/api/prompt-library`.
- Renders: Prompt Library chips bar, Director prompt composer, Storyboard Tray with editable shot cards, Auto-Execute toggle, and real-time execution progress.

- [ ] **Step 1: Build `PromptLibraryTray.tsx`**
Render category pills (Camera Angles, Lighting, Film Stocks) that append modifiers to the active prompt.

- [ ] **Step 2: Build `StoryboardTray.tsx`**
Render multi-shot sequence cards:
  - Shot number, title, camera badge.
  - Inline editable prompt text.
  - Delete shot / re-roll shot controls.
  - `Auto-Execute` switch (ON/OFF).
  - `[🚀 Run Sequence]` button with live progress indicator.

- [ ] **Step 3: Connect Composer and App state**
Toggle between standard single-prompt mode and AI Director Storyboard mode.

- [ ] **Step 4: Verify frontend compilation**
Run: `npm run build` in `frontend/`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add frontend/src/components/director/ frontend/src/components/chat/Composer.tsx frontend/src/App.tsx
git commit -m "feat(ui): add Storyboard Tray, Prompt Library chips, and sequence execution runner"
```

---

### Task 9: Full Integration Test & Verification

**Files:**
- Test: Full backend suite (`python/tests/`)
- Frontend: `npm run build` & browser verification.

- [ ] **Step 1: Run complete backend test suite**
Run: `python/.venv/bin/pytest python/tests/ -v`
Expected: All tests pass (original 41 + all new tests).

- [ ] **Step 2: Run frontend production build**
Run: `npm run build` in `frontend/`
Expected: Clean build with 0 TypeScript or lint errors.

- [ ] **Step 3: Live Verification in Running Daemon**
Restart daemon, open web dashboard, verify:
  - Configure mock/live LLM in Settings.
  - Create character "Freya" with Visual DNA and lock her.
  - Generate a 3-shot storyboard with Camera chips.
  - Verify storyboard cards render with editable prompts.
  - Verify sequence execution and gallery tagging.

- [ ] **Step 4: Commit and Push**
```bash
git add -A
git commit -m "feat(system): complete AI Director, Character Studio, and Storyboard Engine integration"
git push origin master
```

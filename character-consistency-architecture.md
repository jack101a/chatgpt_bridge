# Character Consistency Architecture: 3-Pillar Visual Handshake & Delta Engine

## Goal
Implement the definitive 3-Pillar Character Consistency Engine for ChatGPT/DALL-E:
Turn 0 simultaneous 3-card Visual Ground Truth handshake (`Face`, `Body`, `Expression`), conversational identity locking, and Turns 1..N Clean Delta prompt compilation to completely eliminate prompt fatigue and character drift.

---

## Architecture Overview

$$\text{Visual Ground Truth (3 Images)} + \text{Compact Physical Spec (JSON)} + \text{Clean Delta Prompts}$$

```
+-----------------------------------------------------------------------------------+
| PILLAR 1: TURN 0 CONTRACT HANDSHAKE                                               |
| - Simultaneous 3-card upload: Face Card (16:9) + Body (4:3) + Expression (4:3)    |
| - Compact JSON Physical Spec (name, bone structure, eye color, measurements)      |
| - Thread is permanently marked as PRIMED for this CharacterCard                   |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
| PILLAR 2: TURNS 1..N CLEAN DELTA PROMPTS                                          |
| - NO 400-word prompt bloat. Zero repeated visual DNA text.                        |
| - Structured Delta: [SCENE] [OUTFIT] [POSE] [EXPRESSION] [CAMERA] [LIGHTING]     |
| - Zero upload latency on subsequent turns; 100% DALL-E attention on composition   |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
| PILLAR 3: ADAPTIVE DRIFT MANAGEMENT & AI STORYBOARD DIRECTOR                      |
| - DirectorEngine generates structured Delta storyboard shots                      |
| - Surgical single-card re-attachment only if drift occurs after Turn 6+           |
| - Seamless multi-turn narrative continuity across consistent character scenes     |
+-----------------------------------------------------------------------------------+
```

---

## Tasks

- [ ] **Task 1: Playwright Multi-File Upload & DOM Polling**
  - Extend `python/chatgpt_bridge/ui_driver.py` (`_submit_prompt` and `generate_image`) to accept `image_paths: list[str | Path] | str | Path | None`.
  - Pass all paths to `file_input.first.set_input_files([str(p) for p in paths])`.
  - Update DOM upload spinner poll to verify all attachment progress bars vanish before typing/submitting.
  - Record all uploaded image file IDs in `_delivered_image_ids` to protect against echo bugs.
  - **Verify:** Run isolated unit test with mock/real Playwright attaching multiple files simultaneously.

- [ ] **Task 2: Character Contract Builder & Delta Prompt Compiler**
  - In `python/chatgpt_bridge/characters.py`:
    - Add `get_reference_card_paths(character_id: str) -> list[Path]`: Resolves the 3 cards (`face_lock_image_id`, `body_lock_image_id`, `expression_lock_image_id`) from storage.
    - Add `build_contract_handshake_prompt(character: CharacterCard) -> str`: Formats compact JSON physical contract with explicit conversational binding directives.
    - Add `compile_delta_prompt(character: CharacterCard, scene: str, outfit: str, pose: str, expression: str, camera: str, lighting: str, background: str) -> str`: Produces clean, focused delta prompt referencing locked identity.
  - **Verify:** Run `pytest python/tests/test_character_consistency.py` validating prompt output syntax and card resolution.

- [ ] **Task 3: Turn 0 Handshake Execution in Core & Daemon**
  - In `python/chatgpt_bridge/core.py`:
    - Implement `establish_character_contract(character_id: str, conversation_id: str | None = None) -> dict`: Opens clean chat, submits 3 cards + contract handshake, tracks primed status.
    - Extend `generate_image` to accept `image_paths: list[str | Path] | None`.
  - In `python/chatgpt_bridge/daemon.py`:
    - Add `POST /api/characters/{character_id}/handshake`: Executes Turn 0 handshake on a fresh or existing thread.
    - Add `GET /api/conversations/{cid}/contract`: Checks if conversation has a primed character contract.
    - Extend `ImageRequest` with `reference_images: list[str] | None` for multi-image submission.
    - Add `POST /api/characters/compile-delta` endpoint.
  - **Verify:** `curl -X POST http://localhost:8466/api/characters/{id}/handshake` returns `{ "ok": true, "conversation_id": "...", "character_name": "..." }`.

- [ ] **Task 4: Storyboard Director Integration with Clean Delta Prompts**
  - In `python/chatgpt_bridge/director.py`:
    - Update `DirectorEngine.plan_storyboard` to generate clean delta shots referencing locked character identity rather than concatenating the 400-word `vdna` essay on every shot.
    - Deterministic fallback shots format strictly as Delta Prompts.
  - **Verify:** Run `python/tests/test_director.py` to confirm generated shots use concise delta prompts under 60 words each.

- [ ] **Task 5: Frontend Clean Delta Composer & Handshake Status Badge**
  - In `frontend/src/types.ts` & `frontend/src/api.ts`:
    - Add API client calls for `handshakeCharacter(characterId)` and `compileDeltaPrompt(payload)`.
  - In `frontend/src/components/chat/Composer.tsx`:
    - Add "Character Lock Contract" indicator in active conversation header: displays `[Primed: {name}]` badge with miniature 3-card pill stack.
    - Add "Initialize Contract Handshake" action button when character is locked but thread is unprimed.
    - Add "Delta Mode" structured input toggle (Scene, Outfit, Pose, Camera, Lighting) to compose clean delta shots without prompt clutter.
  - In `frontend/src/components/director/StoryboardTray.tsx`:
    - Integrate with the primed conversation so auto-execution runs as seamless sequential delta shots.
  - **Verify:** Build frontend with `npm run build` and inspect UI with Playwright browser screenshot.

- [ ] **Task 6: Automated End-to-End Live Verification**
  - Create `python/tests/test_character_consistency_e2e.py`:
    - Priming Turn 0 contract handshake with 3 cards (`Nastya`).
    - Submitting Turn 1 clean delta prompt ("Stepping out of a cafe in the rain in a trench coat").
    - Verifying DALL-E response adheres to Nastya's likeness with zero prompt fatigue and zero 400-word bloat.
  - **Verify:** Full test run logs zero errors, generated image saved with correct metadata.

---

## Done When
- [ ] Turn 0 simultaneous 3-card upload executes smoothly via Playwright without timing out.
- [ ] ChatGPT confirms character contract handshake in a dedicated thread.
- [ ] Turns 1..N generate high-fidelity images using Clean Delta prompts without repeating `visual_dna`.
- [ ] Director Storyboard uses Clean Delta prompts for sequential shots.
- [ ] Frontend displays Contract Primed status badge and Clean Delta composer.
- [ ] All tests pass: `pytest python/tests/` and `npm run build`.

---

## Notes & Constraints
- Design system strictly adheres to `DESIGN.md` (Electric Emerald `#10a37f`, OLED Dark `#0a0a0c`).
- Playwright multi-file attachment requires proper sanitization of file paths and waiting for DOM progress rings.
- Prompt terminology avoids triggering content filters by using artistic, cinematic, high-fashion photographic descriptors.

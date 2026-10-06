import pytest
import asyncio
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient

import chatgpt_bridge.daemon as daemon
from chatgpt_bridge.director import StoryboardShot

class _FakeCore:
    async def ask(self, prompt, model=None, conversation_id=None):
        return {"text": f"echo:{prompt}", "conversation_id": conversation_id or "conv-123"}

    async def generate_image(self, prompt, timeout_s=180, **kwargs):
        # Return mocked generation response
        return {"path": "/tmp/test.png", "prompt": prompt}

    async def establish_character_contract(self, char, images_dir=None, conversation_id=None, **kwargs):
        return {"ok": True, "conversation_id": conversation_id or "conv-123", "card_count": 3}

@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(daemon, "_get_core", lambda: _FakeCore())
    # Mock sleep to run fast
    monkeypatch.setattr(asyncio, "sleep", AsyncMock())
    return TestClient(daemon.app)

@pytest.mark.anyio
async def test_director_execute_sequence(client, monkeypatch):
    # We want to trace ws_broadcast calls
    mock_ws_broadcast = AsyncMock()
    monkeypatch.setattr(daemon, "ws_broadcast", mock_ws_broadcast)
    
    # We also want to intercept image generation
    mock_generate = AsyncMock(return_value={"path": "/tmp/test.png", "conversation_id": "test-conv-123"})
    
    # Monkeypatch the background task logic so it blocks or we await it manually?
    # TestClient background tasks run synchronously in the same thread.
    
    # We patch _FakeCore.generate_image to our mock
    fake_core = _FakeCore()
    fake_core.generate_image = mock_generate
    monkeypatch.setattr(daemon, "_get_core", lambda: fake_core)

    req_data = {
        "shots": [
            {
                "description": "shot 1",
                "camera_pov": "pov 1",
                "prompt": "prompt 1"
            },
            {
                "description": "shot 2",
                "camera_pov": "pov 2",
                "prompt": "prompt 2"
            }
        ]
    }
    
    resp = client.post("/api/director/execute", json=req_data)
    assert resp.status_code == 200
    
    # Check that broadcast was called
    # TestClient runs background tasks immediately before returning response
    
    assert mock_ws_broadcast.call_count > 0
    # There should be sequence progress for both shots
    # The requirement says "director_sequence_progress"
    calls = mock_ws_broadcast.call_args_list
    progress_types = [c[0][0].get("type") for c in calls if c[0][0].get("type") == "director_sequence_progress"]
    assert len(progress_types) in (3, 4)
    
    # Verify same conversation ID is passed.
    # The first call might pass None to start a new thread, but subsequent calls MUST pass the returned conversation ID.
    assert mock_generate.call_count == 2
    call1 = mock_generate.call_args_list[0]
    call2 = mock_generate.call_args_list[1]
    
    # We verify that prompts are passed verbatim without any unwanted wrappers
    assert call1[0][0] == "prompt 1"
    assert call2[0][0] == "prompt 2"
    
    conv_id = call2[1].get("conversation_id")
    assert conv_id is not None, "Should reuse conversation ID for visual continuity"

    # Verify state tracking
    status_resp = client.get("/api/director/status")
    status_data = status_resp.json()
    assert status_data["completed_shots"] == 2
    assert status_data["failed_shots"] == 0
    assert len(status_data["shot_results"]) == 2
    assert status_data["status"] == "Complete"


@pytest.mark.anyio
async def test_director_shot_failure_recovery(client, monkeypatch):
    """Edge Case: When shot 2 fails out of 4, the sequence must NOT abort.
    It must record the failure, broadcast director_shot_failed, and continue to shots 3 and 4.
    """
    mock_ws_broadcast = AsyncMock()
    monkeypatch.setattr(daemon, "ws_broadcast", mock_ws_broadcast)

    call_index = 0
    async def mock_generate_with_failure(prompt, **kwargs):
        nonlocal call_index
        call_index += 1
        if call_index == 2:
            # Simulate rejection on shot 2
            from fastapi.responses import JSONResponse
            import json
            return JSONResponse(
                status_code=502,
                content={"detail": "image denied after 10 retries (last: no_image)"}
            )
        return {"path": f"/tmp/shot_{call_index}.png", "conversation_id": "test-conv-continue"}

    fake_core = _FakeCore()
    fake_core.generate_image = mock_generate_with_failure
    monkeypatch.setattr(daemon, "_get_core", lambda: fake_core)

    req_data = {
        "shots": [
            {"description": "shot 1", "camera_pov": "eye level", "prompt": "shot 1"},
            {"description": "shot 2", "camera_pov": "low angle", "prompt": "shot 2"},
            {"description": "shot 3", "camera_pov": "high angle", "prompt": "shot 3"},
            {"description": "shot 4", "camera_pov": "macro", "prompt": "shot 4"},
        ]
    }

    resp = client.post("/api/director/execute", json=req_data)
    assert resp.status_code == 200

    # Verify all 4 shots were attempted
    assert call_index == 4

    # Verify status reflects 3 completed, 1 failed
    status_resp = client.get("/api/director/status")
    st = status_resp.json()
    assert st["completed_shots"] == 3
    assert st["failed_shots"] == 1
    assert len(st["shot_results"]) == 4
    assert st["shot_results"][1]["status"] == "failed"
    assert "no_image" in st["shot_results"][1]["error"]
    assert st["status"] == "Completed 3/4 shots (1 failed)"

    # Verify WS broadcasts included failure and completions
    calls = mock_ws_broadcast.call_args_list
    types = [c[0][0].get("type") for c in calls]
    assert "director_shot_failed" in types
    assert "director_shot_completed" in types


@pytest.mark.anyio
async def test_director_runs_all_shots_without_aborting_on_failures(client, monkeypatch):
    """When shots fail due to general denials/refusals, the sequence must NOT abort early.
    All shots in the sequence must be attempted.
    """
    mock_ws_broadcast = AsyncMock()
    monkeypatch.setattr(daemon, "ws_broadcast", mock_ws_broadcast)

    call_index = 0
    async def mock_generate_all_fail(prompt, **kwargs):
        nonlocal call_index
        call_index += 1
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=502, content={"detail": "image denied after 10 retries (content_policy)"})

    fake_core = _FakeCore()
    fake_core.generate_image = mock_generate_all_fail
    monkeypatch.setattr(daemon, "_get_core", lambda: fake_core)

    req_data = {
        "shots": [
            {"description": f"shot {i}", "camera_pov": "pov", "prompt": f"shot {i}"}
            for i in range(1, 6)
        ]
    }

    resp = client.post("/api/director/execute", json=req_data)
    assert resp.status_code == 200

    # All 5 shots must be attempted
    assert call_index == 5

    status_resp = client.get("/api/director/status")
    st = status_resp.json()
    assert st["completed_shots"] == 0
    assert st["failed_shots"] == 5
    assert len(st["shot_results"]) == 5


@pytest.mark.anyio
async def test_director_aborts_immediately_on_rate_limit(client, monkeypatch):
    """When a rate limit is encountered (429), the sequence must halt immediately
    to preserve character and thread consistency on the active account, without attempting remaining shots or switching accounts.
    """
    mock_ws_broadcast = AsyncMock()
    monkeypatch.setattr(daemon, "ws_broadcast", mock_ws_broadcast)

    call_index = 0
    async def mock_generate_rl(prompt, **kwargs):
        nonlocal call_index
        call_index += 1
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=429,
            content={
                "error": {
                    "type": "GenerationDeniedError",
                    "kind": "rate_limit",
                    "message": "You've reached our limit of 40 messages per 3 hours.",
                    "rate_limit_info": {"resets_at_str": "3:15 PM"},
                }
            },
        )

    fake_core = _FakeCore()
    fake_core.generate_image = mock_generate_rl
    monkeypatch.setattr(daemon, "_get_core", lambda: fake_core)

    req_data = {
        "shots": [
            {"description": f"shot {i}", "camera_pov": "pov", "prompt": f"shot {i}"}
            for i in range(1, 6)
        ]
    }

    resp = client.post("/api/director/execute", json=req_data)
    assert resp.status_code == 200

    # Must abort on shot 1, NOT call all 5 times
    assert call_index == 1

    status_resp = client.get("/api/director/status")
    st = status_resp.json()
    assert st["completed_shots"] == 0
    assert st["failed_shots"] == 1
    assert "Rate limit reached" in st["status"]
    assert "resets at 3:15 PM" in st["status"]
    assert len(st["shot_results"]) == 1
    assert st["shot_results"][0]["status"] == "rate_limited"


@pytest.mark.anyio
async def test_director_raw_prompt_passed_verbatim(client, monkeypatch):
    """Raw prompts and camera tags must be passed completely verbatim to ChatGPT without any injected wrappers."""
    mock_generate = AsyncMock(return_value={"path": "/tmp/test.png", "conversation_id": "test-conv-123"})
    fake_core = _FakeCore()
    fake_core.generate_image = mock_generate
    monkeypatch.setattr(daemon, "_get_core", lambda: fake_core)

    raw_camera_prompt = "low angle shot, camera placed below looking up, dramatic upward perspective"
    req_data = {
        "shots": [
            {"description": "shot 1", "camera_pov": "low angle", "prompt": raw_camera_prompt}
        ]
    }

    resp = client.post("/api/director/execute", json=req_data)
    assert resp.status_code == 200

    sent_prompt = mock_generate.call_args_list[0][0][0]
    assert sent_prompt == raw_camera_prompt


@pytest.mark.anyio
async def test_director_status_and_cancel(client):
    status_resp = client.get("/api/director/status")
    assert status_resp.status_code == 200
    data = status_resp.json()
    assert "is_running" in data
    assert "status" in data

    cancel_resp = client.post("/api/director/cancel")
    assert cancel_resp.status_code == 200
    assert cancel_resp.json()["ok"] is True


@pytest.mark.anyio
async def test_director_2_stage_handshake_with_character(client, monkeypatch):
    from chatgpt_bridge.characters import CharacterCard

    mock_char = CharacterCard(
        id="c-test-char",
        name="Nastya",
        visual_dna="Ash-blonde hair, icy blue eyes",
        roleplay_instructions="Speaks softly with rustic warmth",
    )
    mock_mgr = MagicMock()
    mock_mgr.get.return_value = mock_char
    monkeypatch.setattr(daemon, "_get_character_manager", lambda: mock_mgr)

    mock_ws_broadcast = AsyncMock()
    monkeypatch.setattr(daemon, "ws_broadcast", mock_ws_broadcast)

    fake_core = _FakeCore()
    fake_core.establish_character_contract = AsyncMock(
        return_value={"ok": True, "conversation_id": "conv-nastya-99", "card_count": 3}
    )
    ask_calls = []
    async def fake_ask(prompt, **kwargs):
        ask_calls.append((prompt, kwargs))
        return {"text": "Acknowledged and locked.", "conversation_id": kwargs.get("conversation_id") or "conv-nastya-99"}

    fake_core.ask = fake_ask
    mock_generate = AsyncMock(return_value={"path": "/tmp/shot.png", "conversation_id": "conv-nastya-99"})
    fake_core.generate_image = mock_generate
    monkeypatch.setattr(daemon, "_get_core", lambda: fake_core)

    req_data = {
        "character_id": "c-test-char",
        "shots": [
            {"description": "morning waking", "camera_pov": "close-up", "prompt": "Nastya waking up"}
        ],
        "plot": "Morning chores in rustic cottage",
    }

    mock_contracts = {}
    monkeypatch.setattr(daemon, "_load_conversation_contracts", lambda: mock_contracts)
    def fake_save_contract(cid, info):
        mock_contracts.setdefault(cid, {}).update(info)
    monkeypatch.setattr(daemon, "_save_conversation_contract", fake_save_contract)

    resp = client.post("/api/director/execute", json=req_data)
    assert resp.status_code == 200

    # Verify Turn 1 Roleplay Handshake was called via core.ask
    assert len(ask_calls) >= 1
    roleplay_prompt = ask_calls[-1][0]
    assert "[DIRECTOR'S PRODUCTION CONTRACT: CREATIVE FICTIONAL ROLEPLAY & SCENARIO]" in roleplay_prompt
    assert "Nastya" in roleplay_prompt
    assert "Morning chores in rustic cottage" in roleplay_prompt
    assert "fictional storytelling roleplay" in roleplay_prompt

    # Verify Shot was generated in the same thread
    assert mock_generate.call_count == 1
    gen_call = mock_generate.call_args_list[0]
    assert gen_call[1].get("conversation_id") == "conv-nastya-99"

    # Verify core conversation id stayed pinned to conv-nastya-99
    assert fake_core._current_conversation_id == "conv-nastya-99"


@pytest.mark.anyio
async def test_guide_mode_bypasses_all_handshakes(client, monkeypatch):
    """Guide Mode must NEVER execute Turn 0 or Turn 1 handshakes.
    It must directly execute the camera/POV prompt deltas without character reference cards or roleplay contracts.
    """
    mock_ws_broadcast = AsyncMock()
    monkeypatch.setattr(daemon, "ws_broadcast", mock_ws_broadcast)

    fake_core = _FakeCore()
    ask_calls = []

    async def fake_ask(prompt, **kwargs):
        ask_calls.append(prompt)
        return {"text": "ok", "conversation_id": "conv-guide-1"}

    fake_core.ask = fake_ask

    mock_generate = AsyncMock(return_value={"path": "/tmp/guide.png", "conversation_id": "conv-guide-1"})
    fake_core.generate_image = mock_generate
    monkeypatch.setattr(daemon, "_get_core", lambda: fake_core)

    req_data = {
        "is_guide_mode": True,
        "character_id": "c-test-char",
        "conversation_id": "conv-existing-123",
        "shots": [
            {"description": "shot 1", "camera_pov": "extreme close-up", "prompt": "macro detail of eyelashes and iris, 85mm"},
            {"description": "shot 2", "camera_pov": "medium profile", "prompt": "side profile, 50mm, natural ambient light"},
        ],
    }

    resp = client.post("/api/director/execute", json=req_data)
    assert resp.status_code == 200

    # Ensure core.ask was NEVER called (no Turn 0 or Turn 1 handshakes!)
    assert len(ask_calls) == 0

    # Ensure shots were generated directly with pure deltas
    assert mock_generate.call_count == 2
    assert mock_generate.call_args_list[0][0][0] == "macro detail of eyelashes and iris, 85mm"
    assert mock_generate.call_args_list[1][0][0] == "side profile, 50mm, natural ambient light"



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
    
    # We check the conversation_id logic.
    assert call1[0][0] == "prompt 1"
    assert call2[0][0] == "prompt 2"
    
    conv_id = call2[1].get("conversation_id")
    assert conv_id is not None, "Should reuse conversation ID for visual continuity"


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

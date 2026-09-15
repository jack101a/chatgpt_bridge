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
    assert len(progress_types) == 3
    
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

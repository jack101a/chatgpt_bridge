"""Unit tests for Turn 0 Handshake, Delta compilation, and conversation contract endpoints."""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import AsyncMock, patch
import pytest
from fastapi.testclient import TestClient

from chatgpt_bridge.characters import (
    CharacterCard,
    CharacterManager,
)
import chatgpt_bridge.daemon as daemon


@pytest.fixture
def client(tmp_path: Path):
    char_file = tmp_path / "characters.json"
    contracts_file = tmp_path / "conversation_contracts.json"
    manager = CharacterManager(file_path=char_file)

    # Initialize sample character with reference cards
    images_dir = tmp_path / "images"
    images_dir.mkdir(parents=True)
    card1 = images_dir / "nastya_face.png"
    card2 = images_dir / "nastya_body.png"
    card3 = images_dir / "nastya_expr.png"
    card1.write_bytes(b"face")
    card2.write_bytes(b"body")
    card3.write_bytes(b"expr")

    char = manager.create({
        "id": "char_nastya",
        "name": "Nastya",
        "tagline": "20s Russian beauty",
        "visual_dna": "20s, Russian, natural soft, big bust and ass",
        "face_lock_image_id": "nastya_face",
        "body_lock_image_id": "nastya_body",
        "expression_lock_image_id": "nastya_expr",
    })

    with patch.object(daemon, "_character_manager", manager), \
         patch.object(daemon, "CHARACTERS_FILE", char_file), \
         patch.object(daemon, "CONTRACTS_FILE", contracts_file), \
         patch.object(daemon, "IMAGES_DIR", images_dir):
        test_cli = TestClient(daemon.app)
        yield test_cli, char, images_dir


def test_compile_delta_endpoint(client):
    test_cli, char, _ = client

    resp = test_cli.post("/api/characters/compile-delta", json={
        "character_id": char.id,
        "scene": "Walking through Paris in autumn",
        "outfit": "Cashmere coat and boots",
        "pose": "Looking at the camera while crossing the street",
        "camera": "85mm f/1.4 portrait",
        "lighting": "Golden hour glow",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["character_id"] == char.id
    assert data["character_name"] == "Nastya"
    compiled = data["compiled_prompt"]
    assert "Maintain locked face and body identity from Turn 0." in compiled
    assert "[SCENE]: Walking through Paris in autumn" in compiled
    assert "[OUTFIT]: Cashmere coat and boots" in compiled
    assert "[CAMERA]: 85mm f/1.4 portrait" in compiled
    assert "[LIGHTING]: Golden hour glow" in compiled


def test_conversation_character_binding_and_contract_endpoints(client):
    test_cli, char, _ = client

    # Check unprimed contract initially
    resp = test_cli.get("/api/conversations/conv-123/contract")
    assert resp.status_code == 200
    assert resp.json()["primed"] is False

    # Bind character to conversation
    bind_resp = test_cli.post("/api/conversations/conv-123/character", json={
        "character_id": char.id,
    })
    assert bind_resp.status_code == 200
    assert bind_resp.json()["character_id"] == char.id
    assert bind_resp.json()["character_name"] == "Nastya"

    # Query contract again -> shows bound character
    resp2 = test_cli.get("/api/conversations/conv-123/contract")
    assert resp2.status_code == 200
    assert resp2.json()["character_id"] == char.id
    assert resp2.json()["character_name"] == "Nastya"

    # Unbind character
    unbind_resp = test_cli.post("/api/conversations/conv-123/character", json={
        "character_id": None,
    })
    assert unbind_resp.status_code == 200
    assert unbind_resp.json()["character_id"] is None


def test_character_handshake_endpoint(client):
    test_cli, char, _ = client

    mock_core = AsyncMock()
    mock_core.establish_character_contract.return_value = {
        "ok": True,
        "conversation_id": "conv-handshake-456",
        "character_id": char.id,
        "character_name": char.name,
        "card_count": 3,
        "text": "Understood. Visual identity contract for Nastya is permanently locked into this session.",
    }

    with patch.object(daemon, "_get_core", return_value=mock_core):
        resp = test_cli.post(f"/api/characters/{char.id}/handshake", json={
            "conversation_id": "new",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["ok"] is True
        assert data["conversation_id"] == "conv-handshake-456"
        assert data["card_count"] == 3

        # Verify conversation is now marked as primed
        contract_resp = test_cli.get("/api/conversations/conv-handshake-456/contract")
        assert contract_resp.status_code == 200
        cdata = contract_resp.json()
        assert cdata["primed"] is True
        assert cdata["character_id"] == char.id
        assert cdata["character_name"] == "Nastya"

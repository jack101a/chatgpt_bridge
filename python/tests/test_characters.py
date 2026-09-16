"""Tests for Character Studio storage engine, models, and lock API."""

from __future__ import annotations

import json
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from chatgpt_bridge.characters import (
    CharacterCard,
    CharacterListResponse,
    CharacterManager,
    WardrobeItem,
)
import chatgpt_bridge.daemon as daemon


# --- Unit Tests: Models ---


def test_wardrobe_item_creation():
    item = WardrobeItem(name="Cyberpunk Trench", description="Black leather coat with glowing cyan neon trim")
    assert item.name == "Cyberpunk Trench"
    assert "glowing cyan" in item.description
    assert isinstance(item.id, str) and len(item.id) > 0

    item_with_id = WardrobeItem(id="custom-1", name="Casual", description="Jeans and t-shirt")
    assert item_with_id.id == "custom-1"


def test_character_card_creation_defaults():
    card = CharacterCard(
        name="Nova",
        visual_dna="Silver asymmetrical undercut, piercing amber eyes, cybernetic right arm",
    )
    assert card.name == "Nova"
    assert "piercing amber eyes" in card.visual_dna
    assert card.tagline == ""
    assert card.persona == ""
    assert card.style_anchor == ""
    assert card.wardrobes == []
    assert card.active_wardrobe_id is None
    assert card.avatar_image_id is None
    assert card.created_at > 0
    assert card.updated_at > 0
    assert isinstance(card.id, str) and len(card.id) > 0


def test_character_card_visual_dna_validation():
    # Empty visual_dna must fail validation
    with pytest.raises(ValidationError):
        CharacterCard(name="Nova", visual_dna="")

    with pytest.raises(ValidationError):
        CharacterCard(name="Nova", visual_dna="   ")

    # Empty name must fail validation
    with pytest.raises(ValidationError):
        CharacterCard(name="", visual_dna="Valid visual DNA description")


def test_character_card_wardrobe_helper():
    outfit1 = WardrobeItem(id="w1", name="Combat Suit", description="Nanoweave armor")
    outfit2 = WardrobeItem(id="w2", name="Formal Wear", description="Velvet tuxedo")
    card = CharacterCard(
        name="Agent 47",
        visual_dna="Bald head with barcode tattoo on nape, ice blue eyes, sharp jawline",
        wardrobes=[outfit1, outfit2],
        active_wardrobe_id="w1",
    )
    assert card.get_active_wardrobe() == outfit1
    card.active_wardrobe_id = "w2"
    assert card.get_active_wardrobe() == outfit2
    card.active_wardrobe_id = "non-existent"
    assert card.get_active_wardrobe() is None
    card.active_wardrobe_id = None
    assert card.get_active_wardrobe() is None


# --- Unit Tests: CharacterManager Storage Engine ---


@pytest.fixture
def char_manager(tmp_path: Path) -> CharacterManager:
    json_path = tmp_path / "characters.json"
    return CharacterManager(file_path=json_path)


def test_manager_empty_initial_state(char_manager: CharacterManager):
    assert char_manager.get_all() == []
    assert char_manager.get_active_character_id() is None
    assert char_manager.get_active_character() is None


def test_manager_create_and_get(char_manager: CharacterManager):
    card = CharacterCard(
        name="Kaelen",
        tagline="Shadow runner",
        visual_dna="Tall, midnight blue braided hair, obsidian eyes, angular facial features",
        persona="Tactical, laconic, guarded",
        style_anchor="35mm anamorphic film, Blade Runner aesthetic",
    )
    created = char_manager.create(card)
    assert created.id == card.id
    assert created.name == "Kaelen"

    fetched = char_manager.get(card.id)
    assert fetched is not None
    assert fetched.name == "Kaelen"
    assert fetched.visual_dna == card.visual_dna

    # File should exist and contain valid JSON
    assert char_manager.file_path.exists()
    raw = json.loads(char_manager.file_path.read_text(encoding="utf-8"))
    assert "characters" in raw
    assert len(raw["characters"]) == 1


def test_manager_create_from_dict(char_manager: CharacterManager):
    payload = {
        "name": "Aria",
        "visual_dna": "Crimson bob, freckles across nose, emerald eyes",
        "tagline": "Biohacker prodigy",
    }
    created = char_manager.create(payload)
    assert created.name == "Aria"
    assert created.tagline == "Biohacker prodigy"
    assert char_manager.get(created.id) is not None


def test_manager_update(char_manager: CharacterManager):
    card = char_manager.create({
        "name": "Kaelen",
        "visual_dna": "Tall, midnight blue braided hair, obsidian eyes",
    })
    old_updated_at = card.updated_at

    updated = char_manager.update(card.id, {
        "tagline": "Master Netrunner",
        "persona": "Curious and witty",
    })
    assert updated.tagline == "Master Netrunner"
    assert updated.persona == "Curious and witty"
    assert updated.visual_dna == card.visual_dna  # unchanged
    assert updated.updated_at >= old_updated_at

    with pytest.raises(KeyError):
        char_manager.update("invalid-id", {"name": "Ghost"})


def test_manager_wardrobe_management(char_manager: CharacterManager):
    card = char_manager.create({
        "name": "Kaelen",
        "visual_dna": "Tall, midnight blue braided hair, obsidian eyes",
    })
    # Add wardrobe
    item1 = char_manager.add_wardrobe(card.id, {"name": "Stealth Suit", "description": "Matte black thermal suit"})
    assert item1.name == "Stealth Suit"

    item2 = char_manager.add_wardrobe(card.id, WardrobeItem(name="Civilian", description="Hoodie and cargo pants"))
    assert item2.name == "Civilian"

    refreshed = char_manager.get(card.id)
    assert len(refreshed.wardrobes) == 2

    # Set active wardrobe
    char_manager.set_active_wardrobe(card.id, item1.id)
    refreshed = char_manager.get(card.id)
    assert refreshed.active_wardrobe_id == item1.id
    assert refreshed.get_active_wardrobe().id == item1.id

    # Remove wardrobe
    deleted = char_manager.remove_wardrobe(card.id, item2.id)
    assert deleted is True
    refreshed = char_manager.get(card.id)
    assert len(refreshed.wardrobes) == 1

    # Remove active wardrobe resets active_wardrobe_id to None
    char_manager.remove_wardrobe(card.id, item1.id)
    refreshed = char_manager.get(card.id)
    assert len(refreshed.wardrobes) == 0
    assert refreshed.active_wardrobe_id is None


def test_manager_lock_and_unlock_persistence(tmp_path: Path):
    json_path = tmp_path / "characters.json"
    mgr1 = CharacterManager(file_path=json_path)

    c1 = mgr1.create({"name": "Hero 1", "visual_dna": "Golden armor, blonde hair"})
    c2 = mgr1.create({"name": "Hero 2", "visual_dna": "Dark robe, silver hair"})

    # Lock c1
    active_id = mgr1.lock_character(c1.id)
    assert active_id == c1.id
    assert mgr1.get_active_character_id() == c1.id
    assert mgr1.get_active_character().name == "Hero 1"

    # Reload in a new manager instance to verify disk persistence
    mgr2 = CharacterManager(file_path=json_path)
    assert mgr2.get_active_character_id() == c1.id
    assert mgr2.get_active_character().name == "Hero 1"

    # Toggle lock on c1 -> should unlock
    active_id = mgr2.lock_character(c1.id, toggle=True)
    assert active_id is None
    assert mgr2.get_active_character_id() is None
    assert mgr2.get_active_character() is None

    # Toggle lock on c2 -> should lock c2
    active_id = mgr2.lock_character(c2.id, toggle=True)
    assert active_id == c2.id
    assert mgr2.get_active_character_id() == c2.id

    # Explicit lock None unlocks
    mgr2.set_active_character(None)
    assert mgr2.get_active_character_id() is None

    # Locking nonexistent character raises ValueError
    with pytest.raises(ValueError):
        mgr2.lock_character("nonexistent-char-id")


def test_manager_delete_character_and_active_lock_cleanup(char_manager: CharacterManager):
    c1 = char_manager.create({"name": "Hero 1", "visual_dna": "Golden armor, blonde hair"})
    c2 = char_manager.create({"name": "Hero 2", "visual_dna": "Dark robe, silver hair"})

    # Lock c1
    char_manager.lock_character(c1.id)
    assert char_manager.get_active_character_id() == c1.id

    # Delete non-active c2
    assert char_manager.delete(c2.id) is True
    assert char_manager.get(c2.id) is None
    assert char_manager.get_active_character_id() == c1.id

    # Delete active c1 -> should clean up active lock
    assert char_manager.delete(c1.id) is True
    assert char_manager.get(c1.id) is None
    assert char_manager.get_active_character_id() is None

    # Deleting non-existent character returns False
    assert char_manager.delete("does-not-exist") is False


# --- Integration Tests: Daemon Endpoints ---


@pytest.fixture
def client_with_char_manager(tmp_path: Path, monkeypatch):
    char_file = tmp_path / "characters.json"
    manager = CharacterManager(file_path=char_file)
    monkeypatch.setattr(daemon, "_get_character_manager", lambda: manager)
    return TestClient(daemon.app), manager


def test_endpoint_get_empty_characters(client_with_char_manager):
    client, manager = client_with_char_manager
    resp = client.get("/api/characters")
    assert resp.status_code == 200
    data = resp.json()
    assert data["characters"] == []
    assert data["active_character_id"] is None


def test_endpoint_create_character_ok(client_with_char_manager):
    client, manager = client_with_char_manager
    payload = {
        "name": "Vesper",
        "tagline": "Phantom Operative",
        "visual_dna": "Short charcoal hair, piercing violet eyes, lithe athletic build, sleek stealth bodysuit",
        "persona": "Quiet, observant, razor-sharp focus",
        "style_anchor": "Cinematic sci-fi thriller, low key lighting",
        "wardrobes": [
            {"id": "w1", "name": "Infiltration Suit", "description": "Matte carbon weave suit with hooded cowl"}
        ],
        "active_wardrobe_id": "w1",
    }
    resp = client.post("/api/characters", json=payload)
    assert resp.status_code in (200, 201)
    data = resp.json()
    assert data["name"] == "Vesper"
    assert data["visual_dna"] == payload["visual_dna"]
    assert len(data["wardrobes"]) == 1
    assert data["wardrobes"][0]["id"] == "w1"
    assert data["id"] is not None

    # Verify listing shows it
    list_resp = client.get("/api/characters")
    assert list_resp.status_code == 200
    assert len(list_resp.json()["characters"]) == 1
    assert list_resp.json()["characters"][0]["name"] == "Vesper"


def test_endpoint_create_character_validation_error(client_with_char_manager):
    client, manager = client_with_char_manager
    # Missing visual_dna
    resp = client.post("/api/characters", json={"name": "No DNA"})
    assert resp.status_code == 422

    # Empty visual_dna
    resp2 = client.post("/api/characters", json={"name": "Empty DNA", "visual_dna": "   "})
    assert resp2.status_code == 422


def test_endpoint_update_character(client_with_char_manager):
    client, manager = client_with_char_manager
    create_resp = client.post("/api/characters", json={
        "name": "Marcus",
        "visual_dna": "Broad shoulders, grizzled gray beard, scarred eyebrow",
    })
    char_id = create_resp.json()["id"]

    update_resp = client.put(f"/api/characters/{char_id}", json={
        "tagline": "Veteran Commander",
        "persona": "Stern but protective",
    })
    assert update_resp.status_code == 200
    data = update_resp.json()
    assert data["tagline"] == "Veteran Commander"
    assert data["persona"] == "Stern but protective"
    assert data["name"] == "Marcus"

    # 404 for missing character
    missing_resp = client.put("/api/characters/non-existent-id", json={"tagline": "Ghost"})
    assert missing_resp.status_code == 404


def test_endpoint_delete_character(client_with_char_manager):
    client, manager = client_with_char_manager
    create_resp = client.post("/api/characters", json={
        "name": "Marcus",
        "visual_dna": "Broad shoulders, grizzled gray beard",
    })
    char_id = create_resp.json()["id"]

    del_resp = client.delete(f"/api/characters/{char_id}")
    assert del_resp.status_code == 200
    assert del_resp.json()["ok"] is True

    # Check 404 on subsequent delete
    del_resp_again = client.delete(f"/api/characters/{char_id}")
    assert del_resp_again.status_code == 404


def test_endpoint_lock_and_toggle(client_with_char_manager):
    client, manager = client_with_char_manager
    c1 = manager.create({"name": "Char 1", "visual_dna": "DNA 1"})
    c2 = manager.create({"name": "Char 2", "visual_dna": "DNA 2"})

    # Lock Char 1
    resp1 = client.post(f"/api/characters/{c1.id}/lock")
    assert resp1.status_code == 200
    assert resp1.json()["active_character_id"] == c1.id
    assert resp1.json()["locked"] is True

    # Check GET /api/characters reflects locked character
    list_resp = client.get("/api/characters")
    assert list_resp.json()["active_character_id"] == c1.id

    # POST again to toggle -> should unlock
    resp2 = client.post(f"/api/characters/{c1.id}/lock")
    assert resp2.status_code == 200
    assert resp2.json()["active_character_id"] is None
    assert resp2.json()["locked"] is False

    # Lock Char 2
    resp3 = client.post(f"/api/characters/{c2.id}/lock")
    assert resp3.status_code == 200
    assert resp3.json()["active_character_id"] == c2.id
    assert resp3.json()["locked"] is True

    # Lock Char 1 while Char 2 is active -> switches lock to Char 1
    resp4 = client.post(f"/api/characters/{c1.id}/lock")
    assert resp4.status_code == 200
    assert resp4.json()["active_character_id"] == c1.id
    assert resp4.json()["locked"] is True

    # Lock with explicit body: {"locked": false} -> unlocks
    resp5 = client.post(f"/api/characters/{c1.id}/lock", json={"locked": False})
    assert resp5.status_code == 200
    assert resp5.json()["active_character_id"] is None
    assert resp5.json()["locked"] is False

    # 404 when locking nonexistent character
    resp_err = client.post("/api/characters/unknown-id/lock")
    assert resp_err.status_code == 404


def test_character_consistency_methods(tmp_path: Path):
    images_dir = tmp_path / "images"
    images_dir.mkdir(parents=True)
    card1 = images_dir / "face_card.png"
    card2 = images_dir / "body_card.png"
    card3 = images_dir / "expr_card.png"
    card1.write_bytes(b"face")
    card2.write_bytes(b"body")
    card3.write_bytes(b"expr")

    card = CharacterCard(
        name="Nastya",
        tagline="20s Russian natural beauty",
        visual_dna="20s, Russian, natural soft, big bust and ass, natural soft curve",
        face_lock_image_id="face_card",
        body_lock_image_id="body_card",
        expression_lock_image_id="expr_card",
    )

    paths = card.get_reference_card_paths(images_dir=images_dir)
    assert len(paths) == 3
    assert paths[0] == card1
    assert paths[1] == card2
    assert paths[2] == card3

    # Test Handshake Prompt
    prompt = card.build_contract_handshake_prompt()
    assert "[SYSTEM CONTRACT: IDENTITY LOCK FOR NASTYA]" in prompt
    assert "Image 1: Facial Structure & Features" in prompt
    assert "Image 2: Body Proportions & Anatomy" in prompt
    assert "Image 3: Angle Variations & Bone Structure" in prompt
    assert "Nastya" in prompt

    # Test Delta Prompt Compiler
    delta = card.compile_delta_prompt(
        scene="Stepping out of a cafe in the rain",
        outfit="Beige trench coat over black turtleneck",
        pose="Holding umbrella with one hand, looking over shoulder",
        expression="Subtle mysterious smile",
        camera="85mm f/1.8 lens",
        lighting="Tungsten cafe light and cool rain light",
    )
    assert "Maintain locked face and body identity from Turn 0." in delta
    assert "[SCENE]: Stepping out of a cafe in the rain" in delta
    assert "[OUTFIT]: Beige trench coat over black turtleneck" in delta
    assert "[POSE]: Holding umbrella with one hand, looking over shoulder" in delta
    assert "[EXPRESSION]: Subtle mysterious smile" in delta
    assert "[CAMERA]: 85mm f/1.8 lens" in delta
    assert "[LIGHTING]: Tungsten cafe light and cool rain light" in delta
    # Verify no 400-word essay clutter in delta
    assert "20s, Russian, natural soft, big bust and ass" not in delta

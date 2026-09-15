"""Comprehensive unit and integration tests for companion dashboard endpoints in daemon.py."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

import chatgpt_bridge.daemon as daemon
from chatgpt_bridge.account import AccountInfo, AccountManager


class _DummyAccount:
    def __init__(self, aid: str, alias: str):
        self.id = aid
        self.alias = alias


class _MockCore:
    def __init__(self, state_dir: Path):
        self.state_dir = state_dir
        self.auto_switch = True
        self.max_retries = 10
        self.account_manager = AccountManager(state_dir=state_dir)
        self.pool = type("Pool", (), {"_ids": ["c-test-1", "c-test-2"]})()
        self.deleted_convs: list[str] = []

    async def delete_conversation(self, conversation_id: str) -> bool:
        self.deleted_convs.append(conversation_id)
        return True

    async def switch_account(self, account: str) -> _DummyAccount:
        return _DummyAccount("acc_switched", account)


@pytest.fixture
def test_env(tmp_path, monkeypatch):
    state_dir = tmp_path / "bridge_state"
    images_dir = state_dir / "images"
    images_dir.mkdir(parents=True, exist_ok=True)

    meta_file = state_dir / "gallery_index.json"
    favs_file = state_dir / "favorites.json"
    settings_file = state_dir / "settings.json"
    state_file = state_dir / "client_state.json"

    # Patch daemon paths
    monkeypatch.setattr(daemon, "STATE_DIR", state_dir)
    monkeypatch.setattr(daemon, "IMAGES_DIR", images_dir)
    monkeypatch.setattr(daemon, "META_FILE", meta_file)
    monkeypatch.setattr(daemon, "FAVS_FILE", favs_file)
    monkeypatch.setattr(daemon, "SETTINGS_FILE", settings_file)
    monkeypatch.setattr(daemon, "STATE_FILE", state_file)

    mock_core = _MockCore(state_dir)
    monkeypatch.setattr(daemon, "_get_core", lambda: mock_core)

    client = TestClient(daemon.app)
    return {
        "client": client,
        "state_dir": state_dir,
        "images_dir": images_dir,
        "meta_file": meta_file,
        "favs_file": favs_file,
        "settings_file": settings_file,
        "core": mock_core,
    }


def test_serve_dashboard_html(test_env):
    client = test_env["client"]
    resp = client.get("/")
    assert resp.status_code == 200
    assert "text/html" in resp.headers["content-type"]
    assert "Bridge · Command Deck" in resp.text

    resp2 = client.get("/dashboard")
    assert resp2.status_code == 200
    assert resp2.text == resp.text


def test_gallery_empty(test_env):
    client = test_env["client"]
    resp = client.get("/api/gallery")
    assert resp.status_code == 200
    data = resp.json()
    assert data["items"] == []
    assert data["total"] == 0
    assert data["next_cursor"] is None


@pytest.mark.anyio
async def test_index_generation_and_gallery_pagination(test_env):
    client = test_env["client"]
    images_dir = test_env["images_dir"]

    # Create dummy images
    import os, time
    now = time.time()
    img1 = images_dir / "1000001.png"
    img1.write_bytes(b"dummy image 1 data")
    os.utime(img1, (now - 10, now - 10))
    img2 = images_dir / "1000002.png"
    img2.write_bytes(b"dummy image 2 data")
    os.utime(img2, (now, now))

    await daemon.index_generation(
        img1,
        prompt="portrait of a wizard",
        conversation_id="c-wiz",
        account_used="Primary",
        duration_s=12.5,
    )
    await daemon.index_generation(
        img2,
        prompt="space station orbiting mars",
        tweaked_prompt="space station realistic",
        conversation_id="c-space",
        account_used="Primary",
        duration_s=15.0,
    )

    resp = client.get("/api/gallery")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 2
    assert len(data["items"]) == 2
    assert data["items"][0]["id"] in ["1000001", "1000002"]

    # Test limit=1
    page1 = client.get("/api/gallery?limit=1").json()
    assert len(page1["items"]) == 1
    assert page1["next_cursor"] is not None

    # Test cursor pagination
    page2 = client.get(f"/api/gallery?limit=1&cursor={page1['next_cursor']}").json()
    assert len(page2["items"]) == 1
    assert page2["items"][0]["id"] != page1["items"][0]["id"]


def test_gallery_self_healing_discovery(test_env):
    client = test_env["client"]
    images_dir = test_env["images_dir"]

    # Put a rogue image on disk directly without index
    rogue = images_dir / "rogue_sunset.png"
    rogue.write_bytes(b"image bytes for sunset")

    resp = client.get("/api/gallery")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    item = data["items"][0]
    assert item["id"] == "rogue_sunset"
    assert item["url"] == "/images/rogue_sunset.png"
    assert item["size_bytes"] == len(b"image bytes for sunset")


def test_gallery_favorite_and_delete(test_env):
    client = test_env["client"]
    images_dir = test_env["images_dir"]

    img = images_dir / "fav_test.png"
    img.write_bytes(b"favorite image content")

    # Fetch to self-heal index
    client.get("/api/gallery")

    # Toggle favorite on
    fav_resp = client.post("/api/gallery/fav_test/favorite")
    assert fav_resp.status_code == 200
    assert fav_resp.json()["favorite"] is True

    # Check filter=favorites
    fav_list = client.get("/api/gallery?filter=favorites").json()
    assert fav_list["total"] == 1
    assert fav_list["items"][0]["id"] == "fav_test"
    assert fav_list["items"][0]["favorite"] is True

    # Toggle favorite off
    unfav_resp = client.post("/api/gallery/fav_test/favorite")
    assert unfav_resp.status_code == 200
    assert unfav_resp.json()["favorite"] is False

    # Delete image
    del_resp = client.delete("/api/gallery/fav_test")
    assert del_resp.status_code == 200
    assert del_resp.json()["deleted"] == "fav_test"
    assert not img.exists()

    # Verify gallery is empty
    empty_list = client.get("/api/gallery").json()
    assert empty_list["total"] == 0


def test_chat_summaries_and_purge_stale(test_env):
    client = test_env["client"]
    images_dir = test_env["images_dir"]

    # Create dummy image linked to c-test-1
    img1 = images_dir / "chat_img_1.png"
    img1.write_bytes(b"chat image 1")

    daemon._save_json(
        test_env["meta_file"],
        {
            "chat_img_1": {
                "id": "chat_img_1",
                "prompt": "futuristic car",
                "conversation_id": "c-test-1",
                "created_at": 1000.0,  # very old epoch
                "size_bytes": 12,
            }
        },
    )

    daemon._save_json(test_env["state_dir"] / "chat_pool.json", {"ids": ["c-test-1", "c-test-2"]})

    # GET /api/chats
    chats_resp = client.get("/api/chats")
    assert chats_resp.status_code == 200
    chats = chats_resp.json()
    assert len(chats) >= 2
    c1 = next(c for c in chats if c["conversation_id"] == "c-test-1")
    assert c1["turns"] == 1
    assert c1["last_prompt"] == "futuristic car"
    assert len(c1["thumbnails"]) == 1

    # POST /api/chats/purge_stale
    purge_resp = client.post("/api/chats/purge_stale?older_than_h=1")
    assert purge_resp.status_code == 200
    p_data = purge_resp.json()
    assert p_data["purged"] >= 1
    assert "c-test-1" in test_env["core"].deleted_convs


def test_settings_get_and_patch(test_env):
    client = test_env["client"]
    get_resp = client.get("/api/settings")
    assert get_resp.status_code == 200
    assert "auto_switch" in get_resp.json()
    assert "max_retries" in get_resp.json()

    patch_resp = client.patch(
        "/api/settings", json={"auto_switch": False, "max_retries": 15}
    )
    assert patch_resp.status_code == 200
    data = patch_resp.json()
    assert data["auto_switch"] is False
    assert data["max_retries"] == 15
    assert test_env["core"].auto_switch is False
    assert test_env["core"].max_retries == 15


def test_telemetry(test_env):
    client = test_env["client"]
    resp = client.get("/api/telemetry")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert "uptime_s" in data
    assert "total_images" in data
    assert "browser_busy" in data
    assert data["settings"]["auto_switch"] is True


def test_cookie_import_validation(test_env):
    client = test_env["client"]
    # Bad JSON
    bad_resp = client.post(
        "/api/accounts/cookies",
        json={"account": "Primary", "cookies_json": "not valid json"},
    )
    assert bad_resp.status_code == 400

    # Non-list JSON
    obj_resp = client.post(
        "/api/accounts/cookies",
        json={"account": "Primary", "cookies_json": '{"key": "val"}'},
    )
    assert obj_resp.status_code == 400

    # Valid cookie list
    valid_cookies = json.dumps([{"name": "_puid", "value": "123", "domain": "chatgpt.com"}])
    ok_resp = client.post(
        "/api/accounts/cookies",
        json={"account": "Primary", "cookies_json": valid_cookies},
    )
    assert ok_resp.status_code == 200
    assert ok_resp.json()["ok"] is True


def test_websocket_connection_and_broadcast(test_env):
    client = test_env["client"]
    with client.websocket_connect("/ws/events") as websocket:
        assert len(daemon._ws_clients) == 1
        # Send text keepalive
        websocket.send_text("ping")
    assert len(daemon._ws_clients) == 0


def test_client_state_endpoints(test_env):
    client = test_env["client"]
    # Initial state default
    get_res = client.get("/api/state")
    assert get_res.status_code == 200
    data = get_res.json()
    assert data["currentTab"] == "chat"
    assert data["activeConvId"] is None

    # Update state
    post_res = client.post(
        "/api/state",
        json={
            "currentTab": "gallery",
            "activeConvId": "conv-1234",
            "viewerImageId": "img_test_567",
        },
    )
    assert post_res.status_code == 200
    saved = post_res.json()
    assert saved["currentTab"] == "gallery"
    assert saved["activeConvId"] == "conv-1234"
    assert saved["viewerImageId"] == "img_test_567"
    assert "lastUpdated" in saved

    # Verify persisted in subsequent GET
    get_res2 = client.get("/api/state")
    assert get_res2.status_code == 200
    data2 = get_res2.json()
    assert data2["currentTab"] == "gallery"
    assert data2["activeConvId"] == "conv-1234"
    assert data2["viewerImageId"] == "img_test_567"

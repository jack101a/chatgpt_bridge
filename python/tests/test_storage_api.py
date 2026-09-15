"""Unit tests for storage REST API endpoints in daemon.py."""

from __future__ import annotations

import io
import json
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient
from PIL import Image

import chatgpt_bridge.daemon as daemon


@pytest.fixture
def client(tmp_path: Path, monkeypatch):
    monkeypatch.setattr(daemon, "STATE_DIR", tmp_path)
    monkeypatch.setattr(daemon, "IMAGES_DIR", tmp_path / "images")
    monkeypatch.setattr(daemon, "THUMBNAILS_DIR", tmp_path / "thumbnails")
    monkeypatch.setattr(daemon, "SETTINGS_FILE", tmp_path / "settings.json")
    monkeypatch.setattr(daemon, "META_FILE", tmp_path / "images_metadata.json")
    monkeypatch.setattr(daemon, "FAVS_FILE", tmp_path / "favorites.json")
    monkeypatch.setattr(daemon, "STATE_FILE", tmp_path / "client_state.json")

    (tmp_path / "images").mkdir(parents=True, exist_ok=True)
    (tmp_path / "thumbnails").mkdir(parents=True, exist_ok=True)

    return TestClient(daemon.app)


def test_storage_status_endpoint(client):
    resp = client.get("/api/storage/status")
    assert resp.status_code == 200
    data = resp.json()
    assert "cache_used_bytes" in data
    assert "thumbnail_used_bytes" in data
    assert "cache_limit_mb" in data
    assert "sync_status" in data
    assert data["cache_limit_mb"] == 512


def test_storage_settings_patch(client):
    patch_resp = client.patch(
        "/api/settings",
        json={
            "telegram_storage_enabled": True,
            "telegram_bot_token": "123456:ABC-DEF",
            "telegram_channel_id": "@my_vault",
            "storage_quota_mb": 1024,
        },
    )
    assert patch_resp.status_code == 200
    settings = patch_resp.json()
    assert settings["telegram_storage_enabled"] is True
    assert settings["telegram_bot_token"] == "123456:ABC-DEF"
    assert settings["telegram_channel_id"] == "@my_vault"
    assert settings["storage_quota_mb"] == 1024

    # Verify status reflects the patch
    status_resp = client.get("/api/storage/status")
    assert status_resp.status_code == 200
    status_data = status_resp.json()
    assert status_data["telegram_storage_enabled"] is True
    assert status_data["cache_limit_mb"] == 1024
    assert status_data["has_credentials"] is True


@pytest.mark.anyio
async def test_storage_test_endpoint(client, monkeypatch):
    mock_verify = AsyncMock(return_value={"ok": True, "bot_username": "@test_bot", "can_write": True})
    monkeypatch.setattr(daemon, "verify_telegram_connection", mock_verify)

    resp = client.post(
        "/api/storage/test",
        json={"bot_token": "token123", "channel_id": "@chan123"},
    )
    assert resp.status_code == 200
    assert resp.json()["ok"] is True
    assert resp.json()["bot_username"] == "@test_bot"


def test_thumbnail_endpoint_on_demand_generation(client, tmp_path: Path):
    # Place a 600x600 test image in IMAGES_DIR
    img = Image.new("RGB", (600, 600), color=(0, 200, 100))
    img_path = tmp_path / "images" / "test1.png"
    img.save(img_path, format="PNG")

    # Request thumbnail before it exists on disk
    assert not (tmp_path / "thumbnails" / "test1.webp").exists()

    resp = client.get("/thumbnails/test1.webp")
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "image/webp"

    # Verify WebP was generated and cached on disk
    thumb_path = tmp_path / "thumbnails" / "test1.webp"
    assert thumb_path.exists()
    with Image.open(thumb_path) as t_img:
        assert t_img.format == "WEBP"


def test_image_streaming_and_recaching_from_telegram(client, tmp_path: Path, monkeypatch):
    # Metadata has an evicted image backed by Telegram
    meta = {
        "evicted1": {
            "id": "evicted1",
            "tg_file_id": "file_12345",
            "tg_channel_id": "@chan",
            "is_local": False,
        }
    }
    daemon._save_json(tmp_path / "images_metadata.json", meta)
    daemon._save_json(
        tmp_path / "settings.json",
        {"telegram_bot_token": "valid_token", "telegram_storage_enabled": True},
    )

    # Local PNG is NOT present initially
    png_path = tmp_path / "images" / "evicted1.png"
    assert not png_path.exists()

    # Mock download_file_from_telegram returning raw PNG bytes
    test_img = Image.new("RGB", (100, 100), color=(10, 20, 30))
    buf = io.BytesIO()
    test_img.save(buf, format="PNG")
    mock_bytes = buf.getvalue()

    mock_download = AsyncMock(return_value=mock_bytes)
    monkeypatch.setattr(daemon, "download_file_from_telegram", mock_download)

    # Request the evicted image from /images/evicted1.png
    resp = client.get("/images/evicted1.png")
    assert resp.status_code == 200
    assert resp.content == mock_bytes

    # Verify it was re-cached on disk in local LRU storage
    assert png_path.exists()
    assert png_path.read_bytes() == mock_bytes

    # Verify meta index is_local updated to True
    updated_meta = daemon._load_json(tmp_path / "images_metadata.json", {})
    assert updated_meta["evicted1"]["is_local"] is True


def test_backup_and_restore_endpoints(client, tmp_path: Path, monkeypatch):
    monkeypatch.setattr(daemon, "VAULT_BACKUPS_FILE", tmp_path / "vault_backups.json")
    daemon._save_json(
        tmp_path / "settings.json",
        {"telegram_bot_token": "valid_token", "telegram_channel_id": "@chan", "telegram_storage_enabled": True},
    )

    # 1. Mock upload_vault_manifest
    mock_upload = AsyncMock(return_value={"file_id": "doc123", "message_id": 99, "pinned": True})
    monkeypatch.setattr(daemon, "upload_vault_manifest", mock_upload)
    mock_prune = AsyncMock(return_value=[])
    monkeypatch.setattr(daemon, "prune_backup_history", mock_prune)

    backup_resp = client.post("/api/storage/backup")
    assert backup_resp.status_code == 200
    b_data = backup_resp.json()
    assert b_data["ok"] is True
    assert b_data["message_id"] == 99
    assert b_data["pinned"] is True

    # 2. Verify /api/storage/backups returns the record
    history_resp = client.get("/api/storage/backups")
    assert history_resp.status_code == 200
    h_data = history_resp.json()
    assert h_data["total_backups"] == 1
    assert h_data["latest"]["message_id"] == 99

    # 3. Test /api/storage/restore
    mock_pinned = AsyncMock(return_value={"file_id": "manifest_file_id", "file_name": "bridge_vault_manifest_20260914.json"})
    monkeypatch.setattr(daemon, "get_pinned_manifest_doc", mock_pinned)

    fake_manifest = {
        "version": 1,
        "exported_at": 1000.0,
        "images": {
            "restored_img": {"id": "restored_img", "prompt": "Restored prompt", "tg_file_id": "file_xyz"}
        },
        "favorites": ["restored_img"],
    }
    mock_dl = AsyncMock(return_value=json.dumps(fake_manifest).encode("utf-8"))
    monkeypatch.setattr(daemon, "download_file_from_telegram", mock_dl)

    restore_resp = client.post("/api/storage/restore")
    assert restore_resp.status_code == 200
    r_data = restore_resp.json()
    assert r_data["ok"] is True
    assert r_data["restored_images"] == 1
    assert r_data["restored_favorites"] == 1


def test_topics_endpoint(client, monkeypatch):
    mock_discover = AsyncMock(return_value={"ok": True, "topics": {"data": 8, "general": 1, "backup": 5}})
    monkeypatch.setattr(daemon, "discover_forum_topics", mock_discover)

    resp = client.get("/api/storage/topics")
    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is True
    assert data["topics"]["data"] == 8
    assert data["topics"]["general"] == 1
    assert data["topics"]["backup"] == 5


def test_thumbnails_regenerate_endpoint(client, tmp_path: Path):
    # Create test image
    img = Image.new("RGB", (200, 200), color=(50, 100, 150))
    img.save(tmp_path / "images" / "regen_test.png", format="PNG")

    resp = client.post("/api/storage/thumbnails/regenerate")
    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is True
    assert data["regenerated"] == 1
    assert (tmp_path / "thumbnails" / "regen_test.webp").exists()



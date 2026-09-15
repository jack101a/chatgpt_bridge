"""Unit tests for Vault Manifest generation, restoration, and rotation."""

from __future__ import annotations

import json
from pathlib import Path
import pytest

from chatgpt_bridge.storage_manager import (
    generate_vault_manifest,
    restore_vault_manifest,
    record_backup_history,
    get_backup_history,
)


def test_generate_vault_manifest(tmp_path: Path):
    meta_file = tmp_path / "gallery_index.json"
    favs_file = tmp_path / "favorites.json"
    images_dir = tmp_path / "images"
    images_dir.mkdir()

    # Create dummy image
    img_file = images_dir / "123456789.png"
    img_file.write_bytes(b"dummy image bytes for test")

    meta_file.write_text(json.dumps({
        "123456789": {
            "id": "123456789",
            "filename": "123456789.png",
            "prompt": "Cyberpunk city",
            "tg_file_id": "tg-file-abc",
            "tg_message_id": 42,
            "conversation_id": "conv-1",
            "account_used": "Primary",
            "created_at": 1789400000.0,
            "size_bytes": 26,
            "md5": "e6a27e7d636b04eb8a6147413d7890bb",
        }
    }))
    favs_file.write_text(json.dumps(["123456789"]))

    manifest = generate_vault_manifest(images_dir, meta_file, favs_file)

    assert manifest["version"] == 1
    assert manifest["total_images"] == 1
    assert "123456789" in manifest["images"]
    assert manifest["images"]["123456789"]["filename"] == "123456789.png"
    assert manifest["images"]["123456789"]["md5"] is not None
    assert manifest["images"]["123456789"]["tg_file_id"] == "tg-file-abc"
    assert "123456789" in manifest["favorites"]


def test_restore_vault_manifest(tmp_path: Path):
    meta_file = tmp_path / "gallery_index.json"
    favs_file = tmp_path / "favorites.json"

    manifest_data = {
        "version": 1,
        "exported_at": 1789405000.0,
        "total_images": 2,
        "images": {
            "img_1": {
                "id": "img_1",
                "filename": "img_1.png",
                "prompt": "Sunset over mountain",
                "tg_file_id": "tg-file-1",
                "md5": "hash1",
            },
            "img_2": {
                "id": "img_2",
                "filename": "img_2.png",
                "prompt": "Neon forest",
                "tg_file_id": "tg-file-2",
                "md5": "hash2",
            }
        },
        "favorites": ["img_1"]
    }

    res = restore_vault_manifest(manifest_data, meta_file, favs_file)
    assert res["restored_images"] == 2
    assert res["restored_favorites"] == 1

    restored_meta = json.loads(meta_file.read_text())
    restored_favs = json.loads(favs_file.read_text())

    assert "img_1" in restored_meta
    assert "img_2" in restored_meta
    assert restored_favs == ["img_1"]


def test_backup_history_recording(tmp_path: Path):
    history_file = tmp_path / "vault_backups.json"

    record_backup_history(history_file, message_id=101, filename="bridge_vault_manifest_2026-09-15.json", date_str="2026-09-15", count=50)
    record_backup_history(history_file, message_id=102, filename="bridge_vault_manifest_2026-09-16.json", date_str="2026-09-16", count=52)

    history = get_backup_history(history_file)
    assert len(history) == 2
    assert history[0]["message_id"] == 101
    assert history[1]["message_id"] == 102

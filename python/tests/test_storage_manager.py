"""Unit tests for Telegram storage, thumbnails, and storage manager."""

from __future__ import annotations

import io
from pathlib import Path
import pytest
from PIL import Image

from chatgpt_bridge.thumbnails import generate_thumbnail
from chatgpt_bridge.storage_manager import (
    compute_directory_size,
    get_storage_stats,
    evict_to_budget,
)
from chatgpt_bridge.telegram_storage import (
    verify_telegram_connection,
    upload_document_to_telegram,
    get_telegram_file_path,
    download_file_from_telegram,
    TelegramAuthError,
    TelegramChatError,
)


def test_thumbnail_generation_from_bytes(tmp_path: Path):
    # Create test 1000x800 RGBA image
    img = Image.new("RGBA", (1000, 800), color=(255, 0, 0, 128))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    raw_png = buf.getvalue()

    dest = tmp_path / "thumb.webp"
    thumb_bytes = generate_thumbnail(raw_png, dest_path=dest, max_size=400)

    assert dest.exists()
    assert len(thumb_bytes) > 0

    # Verify generated thumbnail is valid WebP with dimension <= 400
    with Image.open(dest) as t_img:
        assert t_img.format == "WEBP"
        w, h = t_img.size
        assert max(w, h) == 400


def test_storage_manager_eviction(tmp_path: Path):
    images_dir = tmp_path / "images"
    thumbs_dir = tmp_path / "thumbs"
    images_dir.mkdir()
    thumbs_dir.mkdir()

    # Create 3 images of 1MB each
    (images_dir / "img1.png").write_bytes(b"x" * (1024 * 1024))
    (images_dir / "img2.png").write_bytes(b"x" * (1024 * 1024))
    (images_dir / "img3.png").write_bytes(b"x" * (1024 * 1024))

    meta_index = {
        "img1": {"id": "img1", "created_at": 1000, "tg_file_id": "tg-1"},
        "img2": {"id": "img2", "created_at": 2000, "tg_file_id": "tg-2"},
        "img3": {"id": "img3", "created_at": 3000, "tg_file_id": None},  # Not in cloud
    }
    favorites = {"img1"}  # Favorite

    # Quota is 2MB. Total is 3MB.
    # img1 is favorite -> cannot evict.
    # img3 has no tg_file_id -> cannot evict.
    # img2 is cloud backed and not favorite -> should be evicted!
    evicted = evict_to_budget(images_dir, quota_mb=2, favorites=favorites, meta_index=meta_index)

    assert evicted == ["img2"]
    assert (images_dir / "img1.png").exists()
    assert not (images_dir / "img2.png").exists()
    assert (images_dir / "img3.png").exists()


def test_storage_manager_stats(tmp_path: Path):
    images_dir = tmp_path / "images"
    thumbs_dir = tmp_path / "thumbs"
    images_dir.mkdir()
    thumbs_dir.mkdir()

    (images_dir / "img1.png").write_bytes(b"x" * 5000)
    (thumbs_dir / "img1.webp").write_bytes(b"y" * 500)

    meta_index = {
        "img1": {"id": "img1", "tg_file_id": "tg-1"},
        "img2": {"id": "img2", "tg_file_id": "tg-2"},  # Evicted (no local PNG)
    }

    stats = get_storage_stats(images_dir, thumbs_dir, meta_index, quota_mb=512)
    assert stats["cache_used_bytes"] == 5000
    assert stats["thumbnail_used_bytes"] == 500
    assert stats["total_images"] == 2
    assert stats["cloud_backed_count"] == 2
    assert stats["local_full_count"] == 1
    assert stats["evicted_count"] == 1


@pytest.mark.anyio
async def test_telegram_connection_empty_args():
    with pytest.raises(TelegramAuthError):
        await verify_telegram_connection("", "-100123")
    with pytest.raises(TelegramChatError):
        await verify_telegram_connection("123:ABC", "")


def test_quota_invariant_never_evicts_when_under_quota(tmp_path: Path):
    """STRICT INVARIANT: No files should ever be evicted if usage is <= quota."""
    images_dir = tmp_path / "images"
    images_dir.mkdir()

    # Create 5 images of 500KB each (total ~2.5 MB)
    for i in range(5):
        (images_dir / f"img_{i}.png").write_bytes(b"x" * 512000)

    meta_index = {
        f"img_{i}": {"id": f"img_{i}", "created_at": 1000 + i, "tg_file_id": f"tg-{i}"}
        for i in range(5)
    }

    # Quota is 512 MB, usage is only 2.5 MB -> 0 files evicted!
    evicted = evict_to_budget(images_dir, quota_mb=512, favorites=set(), meta_index=meta_index)
    assert evicted == []
    for i in range(5):
        assert (images_dir / f"img_{i}.png").exists()


def test_regenerate_all_thumbnails(tmp_path: Path):
    from chatgpt_bridge.thumbnails import regenerate_all_thumbnails

    images_dir = tmp_path / "images"
    thumbs_dir = tmp_path / "thumbs"
    images_dir.mkdir()
    thumbs_dir.mkdir()

    # Create 2 dummy PNGs
    for i in range(2):
        img = Image.new("RGB", (400, 300), color=(10 * i, 20 * i, 30 * i))
        img.save(images_dir / f"test_{i}.png", format="PNG")

    count = regenerate_all_thumbnails(images_dir, thumbs_dir, max_size=720, quality=85)
    assert count == 2
    assert (thumbs_dir / "test_0.webp").exists()
    assert (thumbs_dir / "test_1.webp").exists()


@pytest.mark.anyio
async def test_fifo_prune_backup_history(tmp_path: Path, monkeypatch):
    from chatgpt_bridge.telegram_storage import prune_backup_history
    import json
    from unittest.mock import AsyncMock

    mock_delete = AsyncMock(return_value=True)
    monkeypatch.setattr("chatgpt_bridge.telegram_storage.delete_chat_message", mock_delete)

    history_file = tmp_path / "vault_backups.json"
    # Create 9 backup records (oldest: msg_1, newest: msg_9)
    records = [{"message_id": i, "date_str": f"day_{i}"} for i in range(1, 10)]
    history_file.write_text(json.dumps(records))

    # Prune keeping max 7 (FIFO: msg_1 and msg_2 should be deleted)
    deleted = await prune_backup_history("fake_token", "-100123", history_file, max_keep=7)

    assert deleted == [1, 2]
    retained = json.loads(history_file.read_text())
    assert len(retained) == 7
    assert retained[0]["message_id"] == 3
    assert retained[-1]["message_id"] == 9


"""Smart LRU cache & storage manager for ChatGPT Bridge image cache."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

log = logging.getLogger("chatgpt_bridge.storage_manager")

DEFAULT_QUOTA_MB = 512


def compute_directory_size(dir_path: Path, pattern: str = "*") -> int:
    """Compute total size in bytes of files matching pattern in dir_path."""
    if not dir_path.exists() or not dir_path.is_dir():
        return 0
    total = 0
    for p in dir_path.glob(pattern):
        if p.is_file():
            try:
                total += p.stat().st_size
            except OSError:
                pass
    return total


def get_storage_stats(
    images_dir: Path,
    thumbnails_dir: Path,
    meta_index: dict[str, Any],
    quota_mb: int = DEFAULT_QUOTA_MB,
) -> dict[str, Any]:
    """Return live metrics on cache usage, thumbnails, and cloud status."""
    cache_used_bytes = compute_directory_size(images_dir, "*.png")
    thumbnail_used_bytes = compute_directory_size(thumbnails_dir, "*.webp")
    cache_limit_bytes = quota_mb * 1024 * 1024 if quota_mb > 0 else 0

    total_images = len(meta_index)
    cloud_backed_count = 0
    local_full_count = 0
    evicted_count = 0

    for item_id, item in meta_index.items():
        has_cloud = bool(item.get("tg_file_id"))
        if has_cloud:
            cloud_backed_count += 1

        local_png = images_dir / f"{item_id}.png"
        is_local = local_png.exists()
        if is_local:
            local_full_count += 1
        elif has_cloud:
            evicted_count += 1

    pct_used = round((cache_used_bytes / cache_limit_bytes) * 100, 1) if cache_limit_bytes > 0 else 0.0

    return {
        "cache_used_bytes": cache_used_bytes,
        "cache_used_mb": round(cache_used_bytes / (1024 * 1024), 2),
        "thumbnail_used_bytes": thumbnail_used_bytes,
        "thumbnail_used_mb": round(thumbnail_used_bytes / (1024 * 1024), 2),
        "cache_limit_bytes": cache_limit_bytes,
        "cache_limit_mb": quota_mb,
        "percent_used": min(100.0, pct_used),
        "total_images": total_images,
        "cloud_backed_count": cloud_backed_count,
        "local_full_count": local_full_count,
        "evicted_count": evicted_count,
        "is_unlimited": quota_mb <= 0,
    }


def evict_to_budget(
    images_dir: Path,
    quota_mb: int,
    favorites: set[str],
    meta_index: dict[str, Any],
) -> list[str]:
    """Evict oldest non-favorite, cloud-backed full-res PNGs until under quota.

    CRITICAL SAFETY RULES:
    1. STRICT INVARIANT: Under NO condition delete any content from local disk until
       the set storage limit (e.g. 512 MB) is actually filled (current_bytes > target_bytes).
    2. NEVER evict if quota_mb <= 0 (unlimited mode).
    3. NEVER evict favorited images.
    4. NEVER evict images that are NOT backed up in Telegram (must have valid tg_file_id).
    5. WebP thumbnails are NEVER touched or deleted.
    6. Only evict just enough to bring total usage back within budget.

    Returns list of evicted image IDs.
    """
    if quota_mb <= 0:
        return []

    target_bytes = quota_mb * 1024 * 1024
    current_bytes = compute_directory_size(images_dir, "*.png")

    # STRICT INVARIANT: Do NOT delete content from local disk until quota is filled!
    if current_bytes <= target_bytes:
        return []

    bytes_to_free = current_bytes - target_bytes

    # Collect eviction candidates
    candidates: list[dict[str, Any]] = []
    for item_id, item in meta_index.items():
        if item_id in favorites:
            continue
        if not item.get("tg_file_id"):
            # Not in Telegram -> DO NOT EVICT!
            continue

        png_path = images_dir / f"{item_id}.png"
        if not png_path.exists():
            continue

        try:
            stat = png_path.stat()
            candidates.append({
                "id": item_id,
                "path": png_path,
                "size": stat.st_size,
                "created_at": float(item.get("created_at") or stat.st_mtime),
            })
        except OSError:
            pass

    # Sort oldest first
    candidates.sort(key=lambda c: c["created_at"])

    evicted: list[str] = []
    freed = 0

    for cand in candidates:
        if freed >= bytes_to_free:
            break
        try:
            cand["path"].unlink(missing_ok=True)
            freed += cand["size"]
            evicted.append(cand["id"])
            if cand["id"] in meta_index:
                meta_index[cand["id"]]["is_local"] = False
            log.info("Evicted local full-res image %s (freed %d bytes)", cand["id"], cand["size"])
        except Exception as exc:
            log.warning("Failed to evict %s: %s", cand["id"], exc)

    return evicted


def compute_file_md5(path: Path) -> str:
    """Calculate MD5 checksum of a file."""
    import hashlib
    h = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def generate_vault_manifest(images_dir: Path, meta_file: Path, favs_file: Path) -> dict[str, Any]:
    """Generate a self-contained catalog snapshot of all library images and metadata.
    
    Includes the 3 key identifiers for every image:
    1. tg_file_id (Telegram persistent cloud ID)
    2. filename (e.g. 1789414889561.png)
    3. md5 (Cryptographic content hash)
    """
    import json
    import time

    idx: dict[str, Any] = {}
    if meta_file.exists():
        try:
            idx = json.loads(meta_file.read_text())
        except Exception:
            idx = {}

    favs: list[str] = []
    if favs_file.exists():
        try:
            favs = json.loads(favs_file.read_text())
        except Exception:
            favs = []

    # Ensure every image has filename and md5
    for stem, item in list(idx.items()):
        if not item.get("filename"):
            item["filename"] = f"{stem}.png"
        if not item.get("md5"):
            png_path = images_dir / f"{stem}.png"
            if png_path.exists():
                try:
                    item["md5"] = compute_file_md5(png_path)
                except Exception:
                    pass

    return {
        "version": 1,
        "exported_at": time.time(),
        "total_images": len(idx),
        "images": idx,
        "favorites": favs,
    }


def restore_vault_manifest(manifest_data: dict[str, Any], meta_file: Path, favs_file: Path) -> dict[str, Any]:
    """Restore gallery index and favorites from a vault manifest snapshot."""
    import json

    restored_images = manifest_data.get("images", {})
    restored_favs = manifest_data.get("favorites", [])

    current_idx: dict[str, Any] = {}
    if meta_file.exists():
        try:
            current_idx = json.loads(meta_file.read_text())
        except Exception:
            current_idx = {}

    # Merge restored images
    for stem, item in restored_images.items():
        if stem not in current_idx:
            current_idx[stem] = item
        else:
            # Fill missing keys like tg_file_id or md5
            for k, v in item.items():
                if current_idx[stem].get(k) is None and v is not None:
                    current_idx[stem][k] = v

    meta_file.parent.mkdir(parents=True, exist_ok=True)
    meta_file.write_text(json.dumps(current_idx, indent=2))

    current_favs = set()
    if favs_file.exists():
        try:
            current_favs = set(json.loads(favs_file.read_text()))
        except Exception:
            current_favs = set()
    current_favs.update(restored_favs)
    favs_file.write_text(json.dumps(sorted(list(current_favs)), indent=2))

    return {
        "restored_images": len(current_idx),
        "restored_favorites": len(current_favs),
    }


def get_backup_history(history_file: Path) -> list[dict[str, Any]]:
    """Retrieve history of uploaded vault manifest snapshots."""
    import json
    if not history_file.exists():
        return []
    try:
        return json.loads(history_file.read_text())
    except Exception:
        return []


def record_backup_history(
    history_file: Path,
    message_id: int,
    filename: str,
    date_str: str,
    count: int,
    file_id: str | None = None,
) -> list[dict[str, Any]]:
    """Append a backup snapshot record to history."""
    import json
    import time
    history = get_backup_history(history_file)
    history.append({
        "message_id": message_id,
        "filename": filename,
        "date_str": date_str,
        "total_images": count,
        "file_id": file_id,
        "timestamp": time.time(),
    })
    history_file.parent.mkdir(parents=True, exist_ok=True)
    history_file.write_text(json.dumps(history, indent=2))
    return history

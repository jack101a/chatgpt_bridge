"""Fast WebP thumbnail generation using Pillow."""

from __future__ import annotations

import io
import logging
from pathlib import Path
try:
    from PIL import Image
except ImportError:
    Image = None

log = logging.getLogger("chatgpt_bridge.thumbnails")

DEFAULT_MAX_DIMENSION = 720  # Middle-ground 720p HD resolution: sharp on retina/mobile screens without pixelation
DEFAULT_WEBP_QUALITY = 85     # Visually lossless WebP with minimal footprint (~50-75 KB)


def generate_thumbnail(
    source_path: Path | bytes,
    dest_path: Path | None = None,
    max_size: int = DEFAULT_MAX_DIMENSION,
    quality: int = DEFAULT_WEBP_QUALITY,
) -> bytes:
    """Generate an optimized progressive WebP thumbnail from an image.

    If dest_path is provided, writes the thumbnail to disk and returns the bytes.
    If dest_path is None, returns the bytes directly.
    """
    if Image is None:
        raw = source_path.read_bytes() if isinstance(source_path, Path) else source_path
        if dest_path is not None:
            dest_path = Path(dest_path)
            dest_path.parent.mkdir(parents=True, exist_ok=True)
            dest_path.write_bytes(raw)
        return raw
    if isinstance(source_path, Path):
        if not source_path.exists():
            raise FileNotFoundError(f"Source image does not exist: {source_path}")
        img = Image.open(source_path)
    else:
        img = Image.open(io.BytesIO(source_path))

    # Convert modes incompatible with WebP (like CMYK, P) to RGB or RGBA
    if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
        img = img.convert("RGBA")
    elif img.mode != "RGB":
        img = img.convert("RGB")

    # Downscale smoothly using high-quality Lanczos resampling
    img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)

    out = io.BytesIO()
    img.save(out, format="WEBP", quality=quality, method=6)
    thumb_bytes = out.getvalue()

    if dest_path is not None:
        dest_path = Path(dest_path)
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        dest_path.write_bytes(thumb_bytes)

    return thumb_bytes


def regenerate_all_thumbnails(
    images_dir: Path,
    thumbnails_dir: Path,
    max_size: int = DEFAULT_MAX_DIMENSION,
    quality: int = DEFAULT_WEBP_QUALITY,
    overwrite: bool = True,
) -> int:
    """Regenerate high-definition crisp WebP thumbnails for all local PNG images.

    Returns the count of successfully regenerated thumbnails.
    """
    if not images_dir.exists():
        return 0

    thumbnails_dir.mkdir(parents=True, exist_ok=True)
    count = 0

    for png_path in images_dir.glob("*.png"):
        dest_webp = thumbnails_dir / f"{png_path.stem}.webp"
        if not overwrite and dest_webp.exists():
            continue
        try:
            generate_thumbnail(png_path, dest_path=dest_webp, max_size=max_size, quality=quality)
            count += 1
        except Exception as exc:
            log.warning("Failed to regenerate thumbnail for %s: %s", png_path.name, exc)

    return count


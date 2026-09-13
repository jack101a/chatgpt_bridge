"""Image wait/download helpers for the UI driver."""

from __future__ import annotations

import asyncio
import time
from pathlib import Path

from .errors import BridgeTimeoutError

# Selector for generated images in the conversation. Generated images carry
# alt="Generated image: ..." and a backend-api/estuary/content src (older
# builds used oaiusercontent). Match by alt first, then by src pattern.
IMAGE_SELECTOR = (
    'img[alt^="Generated image"], '
    'img[src*="backend-api/estuary/content"], '
    'img[src*="oaiusercontent"], '
    'img[src^="data:"]'
)


async def wait_for_image(page, timeout_s: int = 180) -> str:
    """Poll until a generated image appears; return its ``src``.

    Raises :class:`BridgeTimeoutError` if no image appears within ``timeout_s``.
    """
    deadline = time.monotonic() + timeout_s
    while True:
        src = await _find_image_src(page)
        if src:
            return src
        if time.monotonic() >= deadline:
            raise BridgeTimeoutError(
                f"timed out after {timeout_s}s waiting for generated image"
            )
        await asyncio.sleep(1.0)


async def _find_image_src(page) -> str | None:
    """Return the first matching image src, or None."""
    try:
        locator = page.locator(IMAGE_SELECTOR).first
        if await locator.count() == 0:
            return None
        src = await locator.get_attribute("src")
        return src or None
    except Exception:
        return None


_IN_PAGE_FETCH_JS = """async (url) => {
    try {
        const res = await fetch(url, { credentials: 'include' });
        if (!res.ok) return { ok: false, status: res.status };
        const blob = await res.blob();
        return await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve({ ok: true, data: reader.result });
            reader.onerror = () => resolve({ ok: false, error: 'filereader_error' });
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        return { ok: false, error: String(e) };
    }
}"""


async def save_image(src: str, out_dir: Path, ctx=None, page=None) -> Path:
    """Download an image from ``src`` (url/data/blob) and save it to disk.

    If ``page`` is provided (or if ``src`` is a ``blob:`` URL), the image is fetched
    directly inside the authenticated browser context to eliminate 403 Forbidden errors
    and bypass CDN token expiration.
    Falls back to Playwright ``ctx.get(src)`` if in-page fetch fails or page is None.
    """
    out_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{int(time.time() * 1000)}.png"
    dest = out_dir / filename

    if src.startswith("data:"):
        content = _decode_data_url(src)
        dest.write_bytes(content)
        return dest

    # 1. In-page authenticated blob/url fetch if page context is provided
    if page is not None and hasattr(page, "evaluate"):
        try:
            res = await page.evaluate(_IN_PAGE_FETCH_JS, src)
            if isinstance(res, dict) and res.get("ok") and res.get("data"):
                content = _decode_data_url(res["data"])
                dest.write_bytes(content)
                return dest
            elif src.startswith("blob:"):
                err = res.get("error") if isinstance(res, dict) else "unknown"
                raise BridgeTimeoutError(f"in-page blob fetch failed: {err}")
        except Exception as exc:
            if src.startswith("blob:"):
                raise BridgeTimeoutError(
                    f"blob: image URLs require in-page fetch; failed: {exc}"
                ) from exc

    if src.startswith("blob:"):
        raise BridgeTimeoutError(
            "blob: image URLs require in-page fetch; unsupported without page"
        )

    # 2. Remote URL fallback via Playwright request context
    if ctx is not None and hasattr(ctx, "get"):
        resp = await ctx.get(src)
        if resp.status != 200:
            raise BridgeTimeoutError(f"failed to download image (status {resp.status})")
        dest.write_bytes(await resp.body())
        return dest

    raise BridgeTimeoutError(
        "failed to download image: no valid fetch mechanism available (page or ctx required)"
    )


def _decode_data_url(src: str) -> bytes:
    """Decode a ``data:image/png;base64,...`` URL into bytes."""
    import base64

    header, _, b64 = src.partition(",")
    if not b64 or "base64" not in header:
        raise BridgeTimeoutError("unsupported data: URL encoding")
    return base64.b64decode(b64)
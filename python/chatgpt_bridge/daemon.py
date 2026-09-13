"""FastAPI daemon exposing ChatGPT bridge as a universal REST service and companion web dashboard."""

from __future__ import annotations

import asyncio
import hashlib
import json
import os
import time
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from pydantic import BaseModel, Field

from .core import ChatGPT
from .errors import (
    AuthError,
    BridgeTimeoutError,
    DaemonUnreachableError,
    GenerationDeniedError,
    ShapeChangedError,
)

try:
    from playwright.async_api import TimeoutError as PlaywrightTimeoutError
except Exception:  # pragma: no cover - playwright always present at runtime
    PlaywrightTimeoutError = Exception

STATE_DIR = Path(os.environ.get("CHATGPT_BRIDGE_STATE", "~/.chatgpt-bridge")).expanduser()
DAEMON_JSON = STATE_DIR / "daemon.json"
IMAGES_DIR = STATE_DIR / "images"
META_FILE = STATE_DIR / "gallery_index.json"
FAVS_FILE = STATE_DIR / "favorites.json"
SETTINGS_FILE = STATE_DIR / "settings.json"
DASH_HTML = Path(__file__).parent / "dashboard.html"

START_TS = time.time()

# Port defaults to 8465, configurable via PORT or CHATGPT_BRIDGE_PORT
PORT = int(os.environ.get("PORT") or os.environ.get("CHATGPT_BRIDGE_PORT") or "8465")
HOST = os.environ.get("HOST", "0.0.0.0")

app = FastAPI(
    title="ChatGPT Bridge API",
    description="Universal REST API for ChatGPT text conversations and DALL-E image generation with companion dashboard.",
    version="1.1.0",
)

# Enable CORS for universal access from Web, Node.js, Python, or Mobile apps
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Single shared core instance; requests serialized via a lock (single tab).
_core: ChatGPT | None = None
_lock = asyncio.Lock()
_meta_lock = asyncio.Lock()
_ws_clients: set[WebSocket] = set()


class AskRequest(BaseModel):
    prompt: str = Field(..., description="Prompt or message to send to ChatGPT")
    model: str | None = Field(default=None, description="Optional model specifier")
    conversation_id: str | None = Field(default=None, description="Optional conversation ID for continuity")


class ImageRequest(BaseModel):
    prompt: str = Field(..., description="Image prompt description")
    timeout_s: int = Field(default=180, ge=1, description="Timeout in seconds for generation")
    max_tries: int | None = Field(default=None, description="Max retries on refusal (defaults to server config, e.g. 10)")
    conversation_id: str | None = Field(default=None, description="Optional conversation ID for continuity")
    tweaked_prompt: str | None = Field(default=None, description="Optional softer prompt for retries 6-7")
    tweaked_prompt_2: str | None = Field(default=None, description="Optional further refined prompt for retries 8-10")


class SwitchAccountRequest(BaseModel):
    account: str = Field(..., description="Account ID or alias to switch to")


class GalleryItem(BaseModel):
    id: str = Field(..., description="Filename stem / image ID")
    url: str = Field(..., description="Web URL path to the image")
    prompt: str | None = Field(default=None, description="Original prompt text")
    tweaked_prompt: str | None = Field(default=None, description="Level 1 softened prompt")
    tweaked_prompt_2: str | None = Field(default=None, description="Level 2 refined prompt")
    conversation_id: str | None = Field(default=None, description="Associated conversation thread ID")
    account_used: str | None = Field(default=None, description="Account alias that generated the image")
    created_at: float = Field(..., description="Epoch timestamp of generation")
    size_bytes: int = Field(default=0, description="Image file size in bytes")
    md5: str = Field(default="", description="MD5 hash of image file")
    duration_s: float | None = Field(default=None, description="Generation duration in seconds")
    favorite: bool = Field(default=False, description="Whether marked as favorite")


class GalleryPage(BaseModel):
    items: list[GalleryItem]
    next_cursor: str | None = None
    total: int


class ChatSummary(BaseModel):
    conversation_id: str
    turns: int
    thumbnails: list[str]
    last_active: float
    last_prompt: str | None = None


class CookieImport(BaseModel):
    account: str
    cookies_json: str


class SettingsPatch(BaseModel):
    auto_switch: bool | None = None
    max_retries: int | None = None


def _load_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def _save_json(path: Path, obj: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(obj, indent=2), encoding="utf-8")
    tmp.replace(path)


async def ws_broadcast(msg: dict) -> None:
    dead: list[WebSocket] = []
    for ws in list(_ws_clients):
        try:
            await ws.send_json(msg)
        except Exception:
            dead.append(ws)
    for ws in dead:
        _ws_clients.discard(ws)


async def index_generation(
    path: Path,
    *,
    prompt: str | None = None,
    tweaked_prompt: str | None = None,
    tweaked_prompt_2: str | None = None,
    conversation_id: str | None = None,
    account_used: str | None = None,
    duration_s: float | None = None,
) -> dict | None:
    if not path.exists() or not path.is_file():
        return None
    try:
        data = path.read_bytes()
        entry = {
            "id": path.stem,
            "prompt": prompt,
            "tweaked_prompt": tweaked_prompt,
            "tweaked_prompt_2": tweaked_prompt_2,
            "conversation_id": conversation_id,
            "account_used": account_used,
            "created_at": path.stat().st_mtime,
            "size_bytes": len(data),
            "md5": hashlib.md5(data).hexdigest(),
            "duration_s": duration_s,
        }
        async with _meta_lock:
            idx = _load_json(META_FILE, {})
            idx[entry["id"]] = entry
            _save_json(META_FILE, idx)
        await ws_broadcast({"type": "generation_done", "item": entry})
        return entry
    except Exception:
        return None


def _get_core() -> ChatGPT:
    global _core
    if _core is None:
        headless = os.environ.get("CHATGPT_BRIDGE_HEADLESS", "0") == "1"
        _core = ChatGPT(headless=headless)
        settings = _load_json(SETTINGS_FILE, {})
        if "auto_switch" in settings:
            _core.auto_switch = bool(settings["auto_switch"])
        if "max_retries" in settings:
            _core.max_retries = int(settings["max_retries"])
    return _core


def _error_response(exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=502,
        content={"error": {"type": type(exc).__name__, "message": str(exc)}},
    )


# ── Dashboard SPA ──


@app.get("/", response_class=HTMLResponse)
@app.get("/dashboard", response_class=HTMLResponse)
async def serve_dashboard() -> HTMLResponse:
    """Serve the single-page companion dashboard."""
    if DASH_HTML.exists():
        return HTMLResponse(DASH_HTML.read_text(encoding="utf-8"))
    return HTMLResponse(
        "<h1>ChatGPT Bridge Dashboard</h1><p>dashboard.html not found.</p>",
        status_code=404,
    )


# ── Core Bridge Endpoints ──


@app.get("/health")
async def health() -> dict:
    """Basic health check."""
    return {"ok": True}


@app.get("/status")
async def status() -> dict:
    """Detailed runtime status including browser state, memory, and chat pool counts."""
    core = _get_core()
    alive = False
    try:
        if hasattr(core, "session") and hasattr(core.session, "is_alive"):
            alive = await core.session.is_alive()
    except Exception:
        pass
    chats_count = len(core.pool._ids) if hasattr(core, "pool") and hasattr(core.pool, "_ids") else 0
    return {
        "ok": True,
        "authenticated": alive,
        "browser_started": getattr(core, "_started", False),
        "current_conversation_id": getattr(core, "_current_conversation_id", None),
        "chats_tracked": chats_count,
        "max_retries": getattr(core, "max_retries", 10),
        "idle_timeout_s": getattr(core, "idle_timeout_s", 600),
    }


@app.post("/ask")
async def ask(req: AskRequest) -> dict:
    """Send a text prompt to ChatGPT and return the response."""
    async with _lock:
        try:
            return await _get_core().ask(
                req.prompt, model=req.model, conversation_id=req.conversation_id
            )
        except (AuthError, ShapeChangedError, BridgeTimeoutError, DaemonUnreachableError, PlaywrightTimeoutError) as exc:
            return _error_response(exc)


@app.post("/image")
async def image(req: ImageRequest) -> dict:
    """Generate an image using ChatGPT/DALL-E with automatic retry."""
    t0 = time.time()
    await ws_broadcast({
        "type": "generation_progress",
        "status": "Submitting to engine…",
        "retry": 1,
    })
    async with _lock:
        try:
            kwargs = {}
            if req.max_tries is not None:
                kwargs["max_retries"] = req.max_tries
            if req.conversation_id is not None:
                kwargs["conversation_id"] = req.conversation_id
            if req.tweaked_prompt is not None:
                kwargs["tweaked_prompt"] = req.tweaked_prompt
            if req.tweaked_prompt_2 is not None:
                kwargs["tweaked_prompt_2"] = req.tweaked_prompt_2
            result = await _get_core().generate_image(
                req.prompt, timeout_s=req.timeout_s, **kwargs
            )
            # Add relative web image_url for easy frontend consumption
            if "path" in result:
                p = Path(result["path"])
                result["image_url"] = f"/images/{p.name}"
                # Asynchronously index in gallery sidecar
                duration = round(time.time() - t0, 2)
                await index_generation(
                    p,
                    prompt=req.prompt,
                    tweaked_prompt=req.tweaked_prompt,
                    tweaked_prompt_2=req.tweaked_prompt_2,
                    conversation_id=result.get("conversation_id"),
                    account_used=result.get("account_used"),
                    duration_s=duration,
                )
            return result
        except (AuthError, ShapeChangedError, BridgeTimeoutError, DaemonUnreachableError, GenerationDeniedError, PlaywrightTimeoutError) as exc:
            return _error_response(exc)


@app.get("/images/{filename}")
async def get_image(filename: str):
    """Serve downloaded generated images directly over HTTP."""
    file_path = IMAGES_DIR / filename
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(file_path, media_type="image/png")


@app.post("/conversations/new")
async def reset_conversation() -> dict:
    """Reset the current conversation continuity so subsequent requests start a fresh thread."""
    core = _get_core()
    if hasattr(core, "new_chat"):
        core.new_chat()
    return {"ok": True, "message": "Conversation thread reset"}


@app.delete("/conversation/{conversation_id}")
@app.delete("/conversations/{conversation_id}")
@app.post("/conversation/{conversation_id}/delete")
async def delete_conversation(conversation_id: str) -> dict:
    """Delete a conversation from history."""
    async with _lock:
        try:
            ok = await _get_core().delete_conversation(conversation_id)
            return {"ok": ok, "conversation_id": conversation_id}
        except Exception as exc:
            return _error_response(exc)


# ── Accounts Management ──


@app.get("/accounts")
async def list_accounts() -> dict:
    """List all configured accounts, active status, and rate-limit states."""
    core = _get_core()
    mgr = getattr(core, "account_manager", None)
    if not mgr or not hasattr(mgr, "accounts"):
        return {"active_account_id": "default", "accounts": []}
    accs = [
        {
            "id": a.id,
            "alias": a.alias,
            "email": a.email,
            "is_active": a.id == mgr.active_account_id,
            "is_authenticated": a.is_authenticated,
            "total_generations": a.total_generations,
            "consecutive_rate_limits": a.consecutive_rate_limits,
            "is_rate_limited": a.is_rate_limited(),
            "rate_limited_until": a.rate_limited_until,
            "rate_limit_resets_at_str": a.rate_limit_resets_at_str,
        }
        for a in mgr.accounts.values()
    ]
    return {"active_account_id": mgr.active_account_id, "accounts": accs}


@app.get("/api/accounts")
async def api_accounts() -> list[dict]:
    """Direct account list for UI consumption."""
    res = await list_accounts()
    return res.get("accounts", [])


@app.post("/accounts/switch")
async def switch_account(req: SwitchAccountRequest) -> dict:
    """Switch the active account programmatically."""
    core = _get_core()
    async with _lock:
        try:
            acc = await core.switch_account(req.account)
            alias = getattr(acc, "alias", str(acc))
            acc_id = getattr(acc, "id", str(acc))
            await ws_broadcast({"type": "account_switched", "account": alias})
            return {"ok": True, "active_account": alias, "account_id": acc_id}
        except KeyError as e:
            raise HTTPException(status_code=404, detail=str(e))
        except Exception as e:
            return _error_response(e)


@app.post("/api/accounts/cookies")
async def api_import_cookies(body: CookieImport) -> dict:
    """Import exported cookies JSON for a specific account."""
    try:
        parsed = json.loads(body.cookies_json)
        if not isinstance(parsed, list):
            raise ValueError("Cookies payload must be a JSON array of cookie objects")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid cookies JSON: {exc}")

    core = _get_core()
    mgr = getattr(core, "account_manager", None)
    if not mgr:
        raise HTTPException(status_code=500, detail="Account manager not initialized")

    acc = mgr.find_account(body.account)
    if not acc:
        raise HTTPException(status_code=404, detail=f"Account '{body.account}' not found")

    cookies_path = Path(acc.cookies_file)
    cookies_path.parent.mkdir(parents=True, exist_ok=True)
    cookies_path.write_text(body.cookies_json, encoding="utf-8")
    acc.is_authenticated = True
    mgr._save()

    await ws_broadcast({"type": "account_updated", "account": acc.alias or acc.id})
    return {"ok": True, "account": acc.alias or acc.id}


# ── Gallery API ──


@app.get("/api/gallery", response_model=GalleryPage)
async def api_gallery(
    cursor: str | None = None,
    limit: int = Query(40, le=100),
    filter: str = "all",
    conversation_id: str | None = None,
) -> GalleryPage:
    """Paginated image gallery with self-healing discovery of on-disk PNGs."""
    idx = _load_json(META_FILE, {})
    favs = set(_load_json(FAVS_FILE, []))

    # Self-healing: index any image on disk missing from the index
    if IMAGES_DIR.exists():
        modified = False
        for p in IMAGES_DIR.glob("*.png"):
            if p.stem not in idx:
                try:
                    data = p.read_bytes()
                    idx[p.stem] = {
                        "id": p.stem,
                        "prompt": None,
                        "conversation_id": None,
                        "account_used": None,
                        "created_at": p.stat().st_mtime,
                        "size_bytes": len(data),
                        "md5": hashlib.md5(data).hexdigest(),
                        "duration_s": None,
                    }
                    modified = True
                except Exception:
                    pass
        if modified:
            async with _meta_lock:
                _save_json(META_FILE, idx)

    def _sort_key(e: dict) -> tuple[float, str]:
        return (float(e.get("created_at", 0.0)), str(e.get("id", "")))

    items = sorted(idx.values(), key=_sort_key, reverse=True)
    now = time.time()
    if filter == "today":
        items = [e for e in items if now - e.get("created_at", 0) < 86400]
    elif filter == "favorites":
        items = [e for e in items if e["id"] in favs]

    if conversation_id:
        items = [e for e in items if e.get("conversation_id") == conversation_id]

    if cursor:
        if "_" in cursor:
            cur_ts_str, cur_id = cursor.split("_", 1)
            cur_ts = int(cur_ts_str) / 1000.0
            items = [e for e in items if _sort_key(e) < (cur_ts, cur_id)]
        else:
            items = [e for e in items if str(int(e.get("created_at", 0) * 1000)) < cursor]

    page = items[:limit]
    total = len(items)

    res_items: list[GalleryItem] = []
    for e in page:
        res_items.append(
            GalleryItem(
                id=e["id"],
                url=f"/images/{e['id']}.png",
                prompt=e.get("prompt"),
                tweaked_prompt=e.get("tweaked_prompt"),
                tweaked_prompt_2=e.get("tweaked_prompt_2"),
                conversation_id=e.get("conversation_id"),
                account_used=e.get("account_used"),
                created_at=e.get("created_at", 0.0),
                size_bytes=e.get("size_bytes", 0),
                md5=e.get("md5", ""),
                duration_s=e.get("duration_s"),
                favorite=e["id"] in favs,
            )
        )

    nxt = f"{int(page[-1]['created_at'] * 1000)}_{page[-1]['id']}" if len(page) == limit and page else None
    return GalleryPage(items=res_items, next_cursor=nxt, total=total)


@app.get("/api/gallery/{gid}", response_model=GalleryItem)
async def api_gallery_one(gid: str) -> GalleryItem:
    """Retrieve full metadata for a single gallery image."""
    idx = _load_json(META_FILE, {})
    favs = set(_load_json(FAVS_FILE, []))
    if gid not in idx:
        img_path = IMAGES_DIR / f"{gid}.png"
        if img_path.exists() and img_path.is_file():
            data = img_path.read_bytes()
            idx[gid] = {
                "id": gid,
                "prompt": None,
                "conversation_id": None,
                "account_used": None,
                "created_at": img_path.stat().st_mtime,
                "size_bytes": len(data),
                "md5": hashlib.md5(data).hexdigest(),
                "duration_s": None,
            }
            async with _meta_lock:
                _save_json(META_FILE, idx)
        else:
            raise HTTPException(status_code=404, detail="Image not found")
    e = idx[gid]
    return GalleryItem(
        id=e["id"],
        url=f"/images/{e['id']}.png",
        prompt=e.get("prompt"),
        tweaked_prompt=e.get("tweaked_prompt"),
        tweaked_prompt_2=e.get("tweaked_prompt_2"),
        conversation_id=e.get("conversation_id"),
        account_used=e.get("account_used"),
        created_at=e.get("created_at", 0.0),
        size_bytes=e.get("size_bytes", 0),
        md5=e.get("md5", ""),
        duration_s=e.get("duration_s"),
        favorite=e["id"] in favs,
    )


@app.post("/api/gallery/{gid}/favorite")
async def api_fav(gid: str) -> dict:
    """Toggle favorite status for an image."""
    favs = set(_load_json(FAVS_FILE, []))
    if gid in favs:
        favs.discard(gid)
        is_fav = False
    else:
        favs.add(gid)
        is_fav = True
    _save_json(FAVS_FILE, sorted(favs))
    return {"favorite": is_fav}


@app.delete("/api/gallery/{gid}")
async def api_del_img(gid: str) -> dict:
    """Delete an image file and remove it from the index and favorites."""
    img_path = IMAGES_DIR / f"{gid}.png"
    if img_path.exists():
        img_path.unlink()
    async with _meta_lock:
        idx = _load_json(META_FILE, {})
        idx.pop(gid, None)
        _save_json(META_FILE, idx)
    favs = set(_load_json(FAVS_FILE, []))
    if gid in favs:
        favs.discard(gid)
        _save_json(FAVS_FILE, sorted(favs))
    return {"deleted": gid}


# ── Chat Pool API ──


@app.get("/api/chats", response_model=list[ChatSummary])
async def api_chats() -> list[ChatSummary]:
    """Retrieve summarized chat pool conversations with turn counts and thumbnails."""
    idx = _load_json(META_FILE, {})
    pool_file = STATE_DIR / "chat_pool.json"
    raw_pool = _load_json(pool_file, {"ids": []})
    pool_ids: set[str] = set()

    if isinstance(raw_pool, dict):
        pool_ids.update(raw_pool.get("ids", []))
        pool_ids.update(raw_pool.get("_ids", []))
    elif isinstance(raw_pool, list):
        pool_ids.update(raw_pool)

    core = _get_core()
    if hasattr(core, "pool") and hasattr(core.pool, "_ids"):
        pool_ids.update(core.pool._ids)

    # Discover additional conversations from generated images
    for item in idx.values():
        cid = item.get("conversation_id")
        if cid:
            pool_ids.add(cid)

    out: list[ChatSummary] = []
    for cid in pool_ids:
        imgs = sorted(
            [e for e in idx.values() if e.get("conversation_id") == cid],
            key=lambda e: e.get("created_at", 0),
            reverse=True,
        )
        thumbs = [f"/images/{e['id']}.png" for e in imgs[:4] if "id" in e]
        last_active = imgs[0]["created_at"] if imgs else 0.0
        last_prompt = imgs[0].get("prompt") if imgs else None
        out.append(
            ChatSummary(
                conversation_id=cid,
                turns=len(imgs),
                thumbnails=thumbs,
                last_active=last_active,
                last_prompt=last_prompt,
            )
        )
    return sorted(out, key=lambda c: c.last_active, reverse=True)


@app.post("/api/chats/purge_stale")
async def api_purge(older_than_h: int = Query(24, ge=1)) -> dict:
    """Purge conversations inactive for longer than the specified hours."""
    idx = _load_json(META_FILE, {})
    pool_file = STATE_DIR / "chat_pool.json"
    raw_pool = _load_json(pool_file, {"ids": []})
    pool_ids: list[str] = list(raw_pool.get("ids", [])) if isinstance(raw_pool, dict) else list(raw_pool)

    cutoff = time.time() - (older_than_h * 3600)
    kept: list[str] = []
    purged = 0
    core = _get_core()

    for cid in pool_ids:
        c_imgs = [e["created_at"] for e in idx.values() if e.get("conversation_id") == cid]
        last = max(c_imgs) if c_imgs else 0
        if last < cutoff:
            if hasattr(core, "delete_conversation"):
                try:
                    await core.delete_conversation(cid)
                except Exception:
                    pass
            purged += 1
        else:
            kept.append(cid)

    if hasattr(core, "pool") and hasattr(core.pool, "_ids"):
        core.pool._ids = [c for c in core.pool._ids if c in kept]
    _save_json(pool_file, {"ids": kept})
    return {"purged": purged, "remaining": len(kept)}


# ── Settings & Telemetry API ──


@app.get("/api/settings")
async def get_settings() -> dict:
    """Retrieve runtime settings."""
    core = _get_core()
    auto_sw = getattr(core, "auto_switch", True)
    max_ret = getattr(core, "max_retries", 10)
    return _load_json(SETTINGS_FILE, {"auto_switch": auto_sw, "max_retries": max_ret})


@app.patch("/api/settings")
async def patch_settings(p: SettingsPatch) -> dict:
    """Update runtime settings dynamically."""
    core = _get_core()
    s = _load_json(
        SETTINGS_FILE,
        {
            "auto_switch": getattr(core, "auto_switch", True),
            "max_retries": getattr(core, "max_retries", 10),
        },
    )
    if p.auto_switch is not None:
        s["auto_switch"] = p.auto_switch
        if hasattr(core, "auto_switch"):
            core.auto_switch = p.auto_switch
    if p.max_retries is not None:
        s["max_retries"] = p.max_retries
        if hasattr(core, "max_retries"):
            core.max_retries = p.max_retries

    _save_json(SETTINGS_FILE, s)
    return s


@app.get("/api/telemetry")
async def api_telemetry() -> dict:
    """Retrieve real-time health, uptime, and engine state telemetry."""
    core = _get_core()
    active_alias = None
    if hasattr(core, "account_manager"):
        active_acc = core.account_manager.get_active_account()
        active_alias = active_acc.alias if active_acc else None

    total_imgs = len(list(IMAGES_DIR.glob("*.png"))) if IMAGES_DIR.exists() else 0
    s = _load_json(
        SETTINGS_FILE,
        {
            "auto_switch": getattr(core, "auto_switch", True),
            "max_retries": getattr(core, "max_retries", 10),
        },
    )

    return {
        "status": "ok",
        "uptime_s": round(time.time() - START_TS, 1),
        "total_images": total_imgs,
        "active_account": active_alias,
        "browser_busy": _lock.locked(),
        "settings": s,
    }


# ── WebSocket Real-time Events ──


@app.websocket("/ws/events")
async def ws_events(ws: WebSocket):
    """WebSocket stream for real-time progress, switch notifications, and rate limits."""
    await ws.accept()
    _ws_clients.add(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        _ws_clients.discard(ws)


def write_daemon_json() -> None:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    (STATE_DIR / "daemon.json").write_text(
        json.dumps({"pid": os.getpid(), "port": PORT}), encoding="utf-8"
    )


def main() -> None:
    import uvicorn

    write_daemon_json()
    uvicorn.run(app, host=HOST, port=PORT)


if __name__ == "__main__":
    main()
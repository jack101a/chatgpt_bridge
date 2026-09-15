"""FastAPI daemon exposing ChatGPT bridge as a universal REST service and companion web dashboard."""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
import time
from pathlib import Path
from typing import Any

log = logging.getLogger("chatgpt_bridge.daemon")

from fastapi import BackgroundTasks, Body, FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator

from .core import ChatGPT
from .errors import (
    AuthError,
    BridgeTimeoutError,
    DaemonUnreachableError,
    GenerationDeniedError,
    ShapeChangedError,
)
from .storage_manager import (
    DEFAULT_QUOTA_MB,
    compute_directory_size,
    evict_to_budget,
    generate_vault_manifest,
    get_backup_history,
    get_storage_stats,
    record_backup_history,
    restore_vault_manifest,
)
from .telegram_storage import (
    TelegramStorageError,
    delete_chat_message,
    discover_forum_topics,
    download_file_from_telegram,
    get_pinned_manifest_doc,
    pin_chat_message,
    prune_backup_history,
    send_photo_to_telegram,
    upload_document_to_telegram,
    upload_vault_manifest,
    verify_telegram_connection,
)
from .thumbnails import generate_thumbnail, regenerate_all_thumbnails
from .llm_client import OpenAICompatibleClient, mask_api_key
from .characters import (
    CharacterCard,
    CharacterListResponse,
    CharacterManager,
    WardrobeItem,
)
from .director import DirectorEngine, StoryboardPlan, StoryboardShot
from .prompt_library import PromptLibrary
from .face_dictionary import (
    ARCHETYPE_PRESETS,
    FACE_DICTIONARY,
    compile_face_card_prompt,
    compile_visual_dna,
    randomize_face,
)
from .body_dictionary import (
    BODY_ARCHETYPES,
    BODY_DICTIONARY,
    compile_body_card_prompt,
    compile_body_visual_dna,
    randomize_body,
)

try:
    from playwright.async_api import TimeoutError as PlaywrightTimeoutError
except Exception:  # pragma: no cover - playwright always present at runtime
    PlaywrightTimeoutError = Exception

STATE_DIR = Path(os.environ.get("CHATGPT_BRIDGE_STATE", "~/.chatgpt-bridge")).expanduser()
DAEMON_JSON = STATE_DIR / "daemon.json"
IMAGES_DIR = STATE_DIR / "images"
THUMBNAILS_DIR = STATE_DIR / "thumbnails"
META_FILE = STATE_DIR / "gallery_index.json"
FAVS_FILE = STATE_DIR / "favorites.json"
SETTINGS_FILE = STATE_DIR / "settings.json"
STATE_FILE = STATE_DIR / "client_state.json"
VAULT_BACKUPS_FILE = STATE_DIR / "vault_backups.json"
CHARACTERS_FILE = STATE_DIR / "characters.json"
PROMPT_LIBRARY_FILE = STATE_DIR / "prompt_library.json"
DASH_HTML = Path(__file__).parent / "dashboard.html"
FRONTEND_DIST = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"

_prompt_library = PromptLibrary(db_path=str(PROMPT_LIBRARY_FILE))
FRONTEND_DIST_ALT = Path(__file__).parent / "dist"


def _get_dist_dir() -> Path | None:
    if (FRONTEND_DIST / "index.html").exists():
        return FRONTEND_DIST
    if (FRONTEND_DIST_ALT / "index.html").exists():
        return FRONTEND_DIST_ALT
    return None


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

_dist_dir = _get_dist_dir()
if _dist_dir and (_dist_dir / "assets").exists():
    app.mount("/assets", StaticFiles(directory=str(_dist_dir / "assets")), name="assets")

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
    timeout_s: int = Field(default=360, ge=1, description="Timeout in seconds for generation")
    max_tries: int | None = Field(default=None, description="Max retries on refusal (defaults to server config, e.g. 10)")
    conversation_id: str | None = Field(default=None, description="Optional conversation ID for continuity")
    tweaked_prompt: str | None = Field(default=None, description="Optional softer prompt for retries 6-7")
    tweaked_prompt_2: str | None = Field(default=None, description="Optional further refined prompt for retries 8-10")
    reference_image: str | None = Field(default=None, description="Optional reference image ID or filename or URL to attach")
    metadata: dict | None = Field(default=None, description="Optional metadata to store with the image")


class SwitchAccountRequest(BaseModel):
    account: str = Field(..., description="Account ID or alias to switch to")


class GalleryItem(BaseModel):
    id: str = Field(..., description="Filename stem / image ID")
    url: str = Field(..., description="Web URL path to the image")
    thumbnail_url: str | None = Field(default=None, description="Web URL path to the lightweight thumbnail")
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
    tg_file_id: str | None = Field(default=None, description="Telegram cloud storage file ID")
    tg_message_id: int | None = Field(default=None, description="Telegram message ID in channel")
    is_local: bool = Field(default=True, description="Whether full-resolution PNG is currently cached locally")


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
    account_used: str | None = None


class CookieImport(BaseModel):
    account: str
    cookies_json: str


class SettingsPatch(BaseModel):
    auto_switch: bool | None = None
    max_retries: int | None = None
    max_chats: int | None = None
    telegram_storage_enabled: bool | None = None
    telegram_bot_token: str | None = None
    telegram_channel_id: str | None = None
    storage_quota_mb: int | None = None
    telegram_topic_data: int | None = None
    telegram_topic_general: int | None = None
    telegram_topic_backup: int | None = None
    llm_base_url: str | None = None
    llm_api_key: str | None = None
    llm_model: str | None = None


class TelegramTestRequest(BaseModel):
    bot_token: str | None = None
    channel_id: str | None = None


class LLMConfigPayload(BaseModel):
    base_url: str | None = None
    api_key: str | None = None
    model: str | None = None
    llm_base_url: str | None = None
    llm_api_key: str | None = None
    llm_model: str | None = None


class LLMTestRequest(BaseModel):
    base_url: str | None = None
    api_key: str | None = None
    llm_base_url: str | None = None
    llm_api_key: str | None = None


_character_manager: CharacterManager | None = None


def _get_character_manager() -> CharacterManager:
    global _character_manager
    if _character_manager is None:
        _character_manager = CharacterManager(file_path=CHARACTERS_FILE)
    return _character_manager


class CreateCharacterRequest(BaseModel):
    name: str
    tagline: str = ""
    visual_dna: str
    persona: str = ""
    style_anchor: str = ""
    wardrobes: list[WardrobeItem] = Field(default_factory=list)
    active_wardrobe_id: str | None = None
    avatar_image_id: str | None = None
    face_lock_image_id: str | None = None
    body_lock_image_id: str | None = None
    expression_lock_image_id: str | None = None
    character_lock: dict[str, Any] | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("Character name cannot be empty")
        return s

    @field_validator("visual_dna")
    @classmethod
    def validate_visual_dna(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("Character visual_dna cannot be empty")
        return s


class UpdateCharacterRequest(BaseModel):
    name: str | None = None
    tagline: str | None = None
    visual_dna: str | None = None
    persona: str | None = None
    style_anchor: str | None = None
    wardrobes: list[WardrobeItem] | None = None
    active_wardrobe_id: str | None = None
    avatar_image_id: str | None = None
    face_lock_image_id: str | None = None
    body_lock_image_id: str | None = None
    expression_lock_image_id: str | None = None
    character_lock: dict[str, Any] | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str | None) -> str | None:
        if v is not None:
            s = v.strip()
            if not s:
                raise ValueError("Character name cannot be empty")
            return s
        return v

    @field_validator("visual_dna")
    @classmethod
    def validate_visual_dna(cls, v: str | None) -> str | None:
        if v is not None:
            s = v.strip()
            if not s:
                raise ValueError("Character visual_dna cannot be empty")
            return s
        return v


class LockCharacterPayload(BaseModel):
    locked: bool | None = None


class DirectorPlanRequest(BaseModel):
    intent: str = Field(..., description="The scene intent or prompt")
    shot_count: int = Field(default=4, description="Number of shots")
    character_id: str | None = Field(default=None, description="Optional character override. If omitted, uses active character")
    style_override: str | None = Field(default=None, description="Optional style override")


class DirectorExecuteRequest(BaseModel):
    shots: list[StoryboardShot] = Field(..., description="The list of shots to execute")


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
    tg_file_id: str | None = None,
    tg_message_id: int | None = None,
    tg_channel_id: str | int | None = None,
    is_local: bool = True,
    metadata: dict | None = None,
) -> dict | None:
    if not path.exists() or not path.is_file():
        return None
    try:
        data = path.read_bytes()
        entry = {
            "id": path.stem,
            "url": f"/images/{path.name}",
            "thumbnail_url": f"/thumbnails/{path.stem}.webp",
            "prompt": prompt,
            "tweaked_prompt": tweaked_prompt,
            "tweaked_prompt_2": tweaked_prompt_2,
            "conversation_id": conversation_id,
            "account_used": account_used,
            "created_at": path.stat().st_mtime,
            "size_bytes": len(data),
            "md5": hashlib.md5(data).hexdigest(),
            "duration_s": duration_s,
            "tg_file_id": tg_file_id,
            "tg_message_id": tg_message_id,
            "tg_channel_id": str(tg_channel_id) if tg_channel_id else None,
            "is_local": is_local,
            "metadata": metadata or {},
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
        if "max_chats" in settings and hasattr(_core, "pool"):
            _core.pool.max_chats = int(settings["max_chats"])
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
    dist = _get_dist_dir()
    if dist and (dist / "index.html").exists():
        return HTMLResponse((dist / "index.html").read_text(encoding="utf-8"))
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


async def _align_account_for_conversation(cid: str | None) -> None:
    """If conversation is owned by another configured account, auto-switch to it."""
    if not cid:
        return
    cid = cid.strip()
    core = _get_core()
    meta = _load_json(META_FILE, {})
    owner_alias = None
    for entry in meta.values():
        if entry.get("conversation_id") == cid and entry.get("account_used"):
            owner_alias = entry["account_used"]
            break
    if owner_alias and hasattr(core, "account_manager"):
        active = core.account_manager.get_active_account()
        if active and active.alias != owner_alias:
            owner_acc = core.account_manager.find_account(owner_alias)
            if owner_acc and not owner_acc.is_rate_limited:
                log.info(
                    "Auto-aligning account to conversation owner: %s -> %s for cid %s",
                    active.alias,
                    owner_alias,
                    cid,
                )
                try:
                    await core.switch_account(owner_acc.id)
                except Exception as e:
                    log.warning("Failed to auto-align account to %s: %s", owner_alias, e)


@app.post("/ask")
async def ask(req: AskRequest) -> dict:
    """Send a text prompt to ChatGPT and return the response."""
    async with _lock:
        try:
            if req.conversation_id:
                await _align_account_for_conversation(req.conversation_id)
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
                await _align_account_for_conversation(req.conversation_id)
            if req.tweaked_prompt is not None:
                kwargs["tweaked_prompt"] = req.tweaked_prompt
            if req.tweaked_prompt_2 is not None:
                kwargs["tweaked_prompt_2"] = req.tweaked_prompt_2
            if req.reference_image:
                ref = req.reference_image.strip()
                if ref.startswith("/images/"):
                    ref = ref[len("/images/"):]
                elif ref.startswith("images/"):
                    ref = ref[len("images/"):]
                ref_path = IMAGES_DIR / ref
                if not ref_path.exists() and not ref.endswith(".png"):
                    ref_path = IMAGES_DIR / f"{ref}.png"
                if ref_path.exists():
                    kwargs["image_path"] = ref_path
                elif Path(ref).exists():
                    kwargs["image_path"] = Path(ref)

            async def progress_cb(data: dict) -> None:
                await ws_broadcast(data)

            kwargs["on_progress"] = progress_cb
            result = await _get_core().generate_image(
                req.prompt, timeout_s=req.timeout_s, **kwargs
            )
            # Add relative web image_url for easy frontend consumption
            if "path" in result:
                p = Path(result["path"])
                result["image_url"] = f"/images/{p.name}"
                result["thumbnail_url"] = f"/thumbnails/{p.stem}.webp"
                duration = round(time.time() - t0, 2)
                result["duration_s"] = duration

                # 1. Generate lightweight WebP thumbnail
                if p.exists():
                    try:
                        thumb_dest = THUMBNAILS_DIR / f"{p.stem}.webp"
                        generate_thumbnail(p, dest_path=thumb_dest)
                    except Exception as exc:
                        log.warning("Failed to generate thumbnail for %s: %s", p.name, exc)

                # 2. Upload to Telegram Cloud Vault (Data topic for file, General topic for photo)
                settings = _load_json(SETTINGS_FILE, {})
                tg_enabled = bool(settings.get("telegram_storage_enabled", False))
                tg_token = settings.get("telegram_bot_token") or os.environ.get("TELEGRAM_BOT_TOKEN", "")
                tg_chat_id = settings.get("telegram_channel_id") or os.environ.get("TELEGRAM_STORAGE_CHANNEL_ID") or os.environ.get("TELEGRAM_STORAGE_CHAT_ID", "")
                data_topic_id = settings.get("telegram_topic_data", 8)
                general_topic_id = settings.get("telegram_topic_general", 1)

                tg_file_id = None
                tg_message_id = None
                if tg_enabled and tg_token and tg_chat_id and p.exists():
                    # 2a. Post uncompressed full-res PNG file to "Data" topic
                    try:
                        caption = f"🎨 {req.prompt[:500]}"
                        tg_res = await upload_document_to_telegram(
                            token=tg_token,
                            chat_id=tg_chat_id,
                            file_path=p,
                            caption=caption,
                            message_thread_id=data_topic_id,
                        )
                        tg_file_id = tg_res.get("file_id")
                        tg_message_id = tg_res.get("message_id")
                        log.info("Backed up %s to Telegram Data topic (file_id=%s, msg_id=%s)", p.name, tg_file_id, tg_message_id)
                    except Exception as exc:
                        log.error("Telegram Data topic document upload failed for %s: %s", p.name, exc)

                    # 2b. Post pure visual photo to "General" topic (highest quality, pure image view)
                    try:
                        photo_res = await send_photo_to_telegram(
                            token=tg_token,
                            chat_id=tg_chat_id,
                            file_path=p,
                            caption=None,  # Pure image view, zero caption clutter
                            message_thread_id=general_topic_id,
                        )
                        log.info("Sent %s to Telegram General topic as photo (msg_id=%s)", p.name, photo_res.get("message_id"))
                    except Exception as exc:
                        log.warning("Telegram General topic photo send failed for %s: %s", p.name, exc)


                # 3. Asynchronously index in gallery sidecar
                await index_generation(
                    p,
                    prompt=req.prompt,
                    tweaked_prompt=req.tweaked_prompt,
                    tweaked_prompt_2=req.tweaked_prompt_2,
                    conversation_id=result.get("conversation_id"),
                    account_used=result.get("account_used"),
                    duration_s=duration,
                    tg_file_id=tg_file_id,
                    tg_message_id=tg_message_id,
                    tg_channel_id=tg_chat_id if tg_file_id else None,
                    metadata=req.metadata,
                    is_local=True,
                )

                # 4. Prune local cache to budget quota
                quota_mb = int(settings.get("storage_quota_mb", DEFAULT_QUOTA_MB))
                favs = set(_load_json(FAVS_FILE, []))
                idx = _load_json(META_FILE, {})
                evicted = evict_to_budget(IMAGES_DIR, quota_mb, favs, idx)
                if evicted:
                    async with _meta_lock:
                        _save_json(META_FILE, idx)
                    await ws_broadcast({"type": "storage_evicted", "evicted": evicted})

            return result
        except (AuthError, ShapeChangedError, BridgeTimeoutError, DaemonUnreachableError, GenerationDeniedError, PlaywrightTimeoutError) as exc:
            return _error_response(exc)


@app.get("/images/{filename}")
async def get_image(filename: str):
    """Serve downloaded generated images directly over HTTP, streaming from Telegram if evicted."""
    file_path = IMAGES_DIR / filename
    if file_path.exists() and file_path.is_file():
        return FileResponse(file_path, media_type="image/png")

    # Check if image was evicted but exists in Telegram Cloud Vault
    stem = Path(filename).stem
    idx = _load_json(META_FILE, {})
    item = idx.get(stem)
    if item and item.get("tg_file_id"):
        settings = _load_json(SETTINGS_FILE, {})
        tg_token = settings.get("telegram_bot_token") or os.environ.get("TELEGRAM_BOT_TOKEN", "")
        if tg_token:
            try:
                log.info("Serving evicted image %s on-demand from Telegram Cloud Vault...", stem)
                raw = await download_file_from_telegram(tg_token, item["tg_file_id"])
                # Re-cache locally
                file_path.parent.mkdir(parents=True, exist_ok=True)
                file_path.write_bytes(raw)
                item["is_local"] = True
                async with _meta_lock:
                    _save_json(META_FILE, idx)
                return Response(content=raw, media_type="image/png")
            except Exception as exc:
                log.error("Failed to stream image %s from Telegram: %s", stem, exc)
                raise HTTPException(status_code=502, detail=f"Failed to retrieve image from Telegram: {exc}")

    raise HTTPException(status_code=404, detail="Image not found")


@app.get("/thumbnails/{filename}")
async def get_thumbnail(filename: str):
    """Serve low-res WebP thumbnail, auto-generating on-demand if missing."""
    stem = Path(filename).stem
    thumb_path = THUMBNAILS_DIR / f"{stem}.webp"
    if thumb_path.exists() and thumb_path.is_file():
        return FileResponse(thumb_path, media_type="image/webp")

    # Auto-generate thumbnail from local full-res PNG
    png_path = IMAGES_DIR / f"{stem}.png"
    if png_path.exists() and png_path.is_file():
        try:
            generate_thumbnail(png_path, dest_path=thumb_path)
            return FileResponse(thumb_path, media_type="image/webp")
        except Exception as exc:
            log.warning("Failed to auto-generate thumbnail for %s: %s", stem, exc)
            return FileResponse(png_path, media_type="image/png")

    # If local PNG was evicted, check if we can generate thumbnail from Telegram
    idx = _load_json(META_FILE, {})
    item = idx.get(stem)
    if item and item.get("tg_file_id"):
        settings = _load_json(SETTINGS_FILE, {})
        tg_token = settings.get("telegram_bot_token") or os.environ.get("TELEGRAM_BOT_TOKEN", "")
        if tg_token:
            try:
                raw = await download_file_from_telegram(tg_token, item["tg_file_id"])
                generate_thumbnail(raw, dest_path=thumb_path)
                return FileResponse(thumb_path, media_type="image/webp")
            except Exception as exc:
                log.warning("Failed to generate thumbnail from Telegram for %s: %s", stem, exc)

    raise HTTPException(status_code=404, detail="Thumbnail not found")


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
    elif filter == "week":
        items = [e for e in items if now - e.get("created_at", 0) < 7 * 86400]
    elif filter == "month":
        items = [e for e in items if now - e.get("created_at", 0) < 30 * 86400]
    elif filter == "year":
        items = [e for e in items if now - e.get("created_at", 0) < 365 * 86400]
    elif filter == "favorites":
        items = [e for e in items if e["id"] in favs]

    if conversation_id:
        items = [e for e in items if e.get("conversation_id") == conversation_id]

    total = len(items)

    if cursor:
        if "_" in cursor:
            cur_ts_str, cur_id = cursor.split("_", 1)
            cur_ts = int(cur_ts_str) / 1000.0
            items = [e for e in items if _sort_key(e) < (cur_ts, cur_id)]
        else:
            items = [e for e in items if str(int(e.get("created_at", 0) * 1000)) < cursor]

    page = items[:limit]

    res_items: list[GalleryItem] = []
    for e in page:
        res_items.append(
            GalleryItem(
                id=e["id"],
                url=f"/images/{e['id']}.png",
                thumbnail_url=f"/thumbnails/{e['id']}.webp",
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
                tg_file_id=e.get("tg_file_id"),
                tg_message_id=e.get("tg_message_id"),
                is_local=(IMAGES_DIR / f"{e['id']}.png").exists(),
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
        thumbnail_url=f"/thumbnails/{e['id']}.webp",
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
        tg_file_id=e.get("tg_file_id"),
        tg_message_id=e.get("tg_message_id"),
        is_local=(IMAGES_DIR / f"{e['id']}.png").exists(),
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
        account_used = imgs[0].get("account_used") if imgs else None
        out.append(
            ChatSummary(
                conversation_id=cid,
                turns=len(imgs),
                thumbnails=thumbs,
                last_active=last_active,
                last_prompt=last_prompt,
                account_used=account_used,
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
    max_c = getattr(core.pool, "max_chats", 25) if hasattr(core, "pool") else 25
    s = _load_json(
        SETTINGS_FILE,
        {
            "auto_switch": auto_sw,
            "max_retries": max_ret,
            "max_chats": max_c,
            "telegram_storage_enabled": False,
            "telegram_bot_token": os.environ.get("TELEGRAM_BOT_TOKEN", ""),
            "telegram_channel_id": os.environ.get("TELEGRAM_STORAGE_CHANNEL_ID") or os.environ.get("TELEGRAM_STORAGE_CHAT_ID", ""),
            "storage_quota_mb": DEFAULT_QUOTA_MB,
            "telegram_topic_data": 8,
            "telegram_topic_general": 1,
            "telegram_topic_backup": 5,
        },
    )
    if "auto_switch" not in s:
        s["auto_switch"] = auto_sw
    if "max_retries" not in s:
        s["max_retries"] = max_ret
    if "max_chats" not in s:
        s["max_chats"] = max_c
    if "telegram_storage_enabled" not in s:
        s["telegram_storage_enabled"] = False
    if "telegram_bot_token" not in s:
        s["telegram_bot_token"] = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    if "telegram_channel_id" not in s:
        s["telegram_channel_id"] = os.environ.get("TELEGRAM_STORAGE_CHANNEL_ID") or os.environ.get("TELEGRAM_STORAGE_CHAT_ID", "")
    if "storage_quota_mb" not in s:
        s["storage_quota_mb"] = DEFAULT_QUOTA_MB
    if "telegram_topic_data" not in s:
        s["telegram_topic_data"] = 8
    if "telegram_topic_general" not in s:
        s["telegram_topic_general"] = 1
    if "telegram_topic_backup" not in s:
        s["telegram_topic_backup"] = 5
    if "llm_base_url" not in s:
        s["llm_base_url"] = os.environ.get("LLM_BASE_URL") or os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1")
    if "llm_api_key" not in s:
        s["llm_api_key"] = os.environ.get("LLM_API_KEY") or os.environ.get("OPENAI_API_KEY", "")
    if "llm_model" not in s:
        s["llm_model"] = os.environ.get("LLM_MODEL", "gpt-4o")
    return s


@app.patch("/api/settings")
async def patch_settings(p: SettingsPatch) -> dict:
    """Update runtime settings dynamically."""
    core = _get_core()
    s = await get_settings()
    if p.auto_switch is not None:
        s["auto_switch"] = p.auto_switch
        if hasattr(core, "auto_switch"):
            core.auto_switch = p.auto_switch
    if p.max_retries is not None:
        s["max_retries"] = p.max_retries
        if hasattr(core, "max_retries"):
            core.max_retries = p.max_retries
    if p.max_chats is not None:
        s["max_chats"] = p.max_chats
        if hasattr(core, "pool"):
            core.pool.max_chats = p.max_chats
    if p.telegram_storage_enabled is not None:
        s["telegram_storage_enabled"] = p.telegram_storage_enabled
    if p.telegram_bot_token is not None:
        s["telegram_bot_token"] = p.telegram_bot_token.strip()
    if p.telegram_channel_id is not None:
        s["telegram_channel_id"] = p.telegram_channel_id.strip()
    if p.telegram_topic_data is not None:
        s["telegram_topic_data"] = p.telegram_topic_data
    if p.telegram_topic_general is not None:
        s["telegram_topic_general"] = p.telegram_topic_general
    if p.telegram_topic_backup is not None:
        s["telegram_topic_backup"] = p.telegram_topic_backup
    if p.llm_base_url is not None:
        s["llm_base_url"] = p.llm_base_url.strip()
    if p.llm_api_key is not None and "****" not in p.llm_api_key:
        s["llm_api_key"] = p.llm_api_key.strip()
    if p.llm_model is not None:
        s["llm_model"] = p.llm_model.strip()
    if p.storage_quota_mb is not None:
        s["storage_quota_mb"] = p.storage_quota_mb
        # Trigger immediate re-budget
        favs = set(_load_json(FAVS_FILE, []))
        idx = _load_json(META_FILE, {})
        evicted = evict_to_budget(IMAGES_DIR, p.storage_quota_mb, favs, idx)
        if evicted:
            async with _meta_lock:
                _save_json(META_FILE, idx)
            await ws_broadcast({"type": "storage_evicted", "evicted": evicted})

    _save_json(SETTINGS_FILE, s)
    return s


# ── AI Director & LLM Configuration API ──


@app.get("/api/llm/config")
async def get_llm_config() -> dict:
    """Retrieve OpenAI-compatible LLM configuration with masked API key."""
    settings = _load_json(SETTINGS_FILE, {})
    raw_key = settings.get("llm_api_key") or os.environ.get("LLM_API_KEY") or os.environ.get("OPENAI_API_KEY", "")
    base_url = settings.get("llm_base_url") or os.environ.get("LLM_BASE_URL") or os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1")
    model = settings.get("llm_model") or os.environ.get("LLM_MODEL", "gpt-4o")
    masked = mask_api_key(raw_key)

    return {
        "base_url": base_url,
        "api_key": masked,
        "model": model,
        "has_key": bool(raw_key),
        "llm_base_url": base_url,
        "llm_api_key": masked,
        "llm_model": model,
    }


@app.post("/api/llm/config")
async def post_llm_config(payload: LLMConfigPayload) -> dict:
    """Update OpenAI-compatible LLM configuration in settings.json."""
    settings = _load_json(SETTINGS_FILE, {})

    new_base_url = payload.base_url if payload.base_url is not None else payload.llm_base_url
    new_api_key = payload.api_key if payload.api_key is not None else payload.llm_api_key
    new_model = payload.model if payload.model is not None else payload.llm_model

    if new_base_url is not None:
        settings["llm_base_url"] = new_base_url.strip()
    if new_api_key is not None:
        key_str = new_api_key.strip()
        if "****" not in key_str:
            settings["llm_api_key"] = key_str
    if new_model is not None:
        settings["llm_model"] = new_model.strip()

    _save_json(SETTINGS_FILE, settings)

    raw_key = settings.get("llm_api_key", "")
    base_url = settings.get("llm_base_url", "https://api.openai.com/v1")
    model = settings.get("llm_model", "gpt-4o")
    masked = mask_api_key(raw_key)

    return {
        "ok": True,
        "base_url": base_url,
        "api_key": masked,
        "model": model,
        "has_key": bool(raw_key),
        "llm_base_url": base_url,
        "llm_api_key": masked,
        "llm_model": model,
    }


@app.post("/api/llm/test")
async def post_llm_test(payload: LLMTestRequest | None = None) -> dict:
    """Validate connection to OpenAI-compatible LLM endpoint."""
    settings = _load_json(SETTINGS_FILE, {})

    req_base = (payload.base_url if payload and payload.base_url is not None else (payload.llm_base_url if payload else None))
    req_key = (payload.api_key if payload and payload.api_key is not None else (payload.llm_api_key if payload else None))

    base_url = (req_base.strip() if req_base else "") or settings.get("llm_base_url") or os.environ.get("LLM_BASE_URL") or os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1")

    if req_key and "****" not in req_key:
        api_key = req_key.strip()
    else:
        api_key = settings.get("llm_api_key") or os.environ.get("LLM_API_KEY") or os.environ.get("OPENAI_API_KEY", "")

    client = OpenAICompatibleClient()
    ok, message, models = await client.test_connection(base_url=base_url, api_key=api_key)

    res: dict[str, Any] = {
        "ok": ok,
        "message": message,
        "models": models,
    }
    if not ok:
        res["error"] = message
    return res


# ── Character Studio & Active Session Lock API ──


@app.get("/api/characters", response_model=CharacterListResponse)
async def get_characters() -> CharacterListResponse:
    """Retrieve all saved characters and current session active locked character."""
    mgr = _get_character_manager()
    chars = mgr.get_all()
    active_id = mgr.get_active_character_id()
    active_char = mgr.get_active_character()
    return CharacterListResponse(
        characters=chars,
        active_character_id=active_id,
        active_character=active_char,
    )


@app.post("/api/characters", response_model=CharacterCard)
async def create_character(payload: CreateCharacterRequest) -> CharacterCard:
    """Create and persist a new character card."""
    mgr = _get_character_manager()
    card = CharacterCard(**payload.model_dump())
    return mgr.create(card)


@app.put("/api/characters/{character_id}", response_model=CharacterCard)
async def update_character(character_id: str, payload: UpdateCharacterRequest) -> CharacterCard:
    """Update fields of an existing character card."""
    mgr = _get_character_manager()
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    try:
        return mgr.update(character_id, updates)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Character '{character_id}' not found")
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@app.delete("/api/characters/{character_id}")
async def delete_character(character_id: str) -> dict[str, Any]:
    """Delete character by ID and remove active lock if this character was locked."""
    mgr = _get_character_manager()
    success = mgr.delete(character_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Character '{character_id}' not found")
    return {"ok": True, "id": character_id}


@app.post("/api/characters/{character_id}/lock")
async def lock_character_endpoint(
    character_id: str,
    payload: LockCharacterPayload | None = None,
    unlock: bool = Query(default=False),
) -> dict[str, Any]:
    """Toggle or set active locked character in session."""
    mgr = _get_character_manager()
    char = mgr.get(character_id)
    if not char:
        raise HTTPException(status_code=404, detail=f"Character '{character_id}' not found")

    if unlock or (payload and payload.locked is False):
        active_id = mgr.lock_character(None)
    elif payload and payload.locked is True:
        active_id = mgr.lock_character(character_id, toggle=False)
    else:
        active_id = mgr.lock_character(character_id, toggle=True)

    return {
        "ok": True,
        "character_id": character_id,
        "active_character_id": active_id,
        "locked": active_id == character_id,
        "character": char if active_id == character_id else None,
    }


# ── Reference Card Generator API ──


class FaceCardDataPayload(BaseModel):
    data: dict[str, Any] = Field(default_factory=dict)


class FaceCardRandomizePayload(BaseModel):
    archetype: str | None = None


class FaceCardGeneratePayload(BaseModel):
    data: dict[str, Any] = Field(default_factory=dict)
    conversation_id: str | None = None
    prompt: str | None = None


@app.get("/api/cards/face/dictionary")
async def get_face_card_dictionary() -> dict[str, Any]:
    """Return dynamic data dictionary schema and harmonized archetype presets."""
    return {
        "ok": True,
        "dictionary": FACE_DICTIONARY,
        "archetypes": ARCHETYPE_PRESETS,
    }


@app.post("/api/cards/face/compile-prompt")
async def compile_face_card_prompt_endpoint(payload: FaceCardDataPayload) -> dict[str, Any]:
    """Compile dictionary selections into standard 16:9 prompt template and Visual DNA."""
    prompt = compile_face_card_prompt(payload.data)
    visual_dna = compile_visual_dna(payload.data)
    return {
        "ok": True,
        "prompt": prompt,
        "visual_dna": visual_dna,
    }


@app.post("/api/cards/face/randomize")
async def randomize_face_card_endpoint(payload: FaceCardRandomizePayload | None = None) -> dict[str, Any]:
    """Generate a coherent randomized face dictionary payload with compiled prompt."""
    archetype = payload.archetype if payload else None
    data = randomize_face(archetype)
    prompt = compile_face_card_prompt(data)
    visual_dna = compile_visual_dna(data)
    return {
        "ok": True,
        "data": data,
        "prompt": prompt,
        "visual_dna": visual_dna,
    }


@app.post("/api/cards/face/generate")
async def generate_face_card_endpoint(payload: FaceCardGeneratePayload) -> dict[str, Any]:
    """Compile prompt and invoke 16:9 image generation engine directly."""
    prompt = payload.prompt.strip() if payload.prompt and payload.prompt.strip() else compile_face_card_prompt(payload.data)
    visual_dna = compile_visual_dna(payload.data)
    req = ImageRequest(
        prompt=prompt,
        conversation_id=payload.conversation_id,
        metadata={
            "card_type": "face_identity",
            "face_data": payload.data,
            "visual_dna": visual_dna,
        },
    )
    result = await image(req)
    return {
        "ok": True,
        "result": result,
        "prompt": prompt,
        "visual_dna": visual_dna,
        "face_data": payload.data,
    }


class BodyCardDataPayload(BaseModel):
    data: dict[str, Any] = Field(default_factory=dict)


class BodyCardRandomizePayload(BaseModel):
    archetype: str | None = None


class BodyCardGeneratePayload(BaseModel):
    data: dict[str, Any] = Field(default_factory=dict)
    conversation_id: str | None = None
    prompt: str | None = None


@app.get("/api/cards/body/dictionary")
async def get_body_card_dictionary() -> dict[str, Any]:
    """Return dynamic data dictionary schema and harmonized archetype presets for body cards."""
    return {
        "ok": True,
        "dictionary": BODY_DICTIONARY,
        "archetypes": BODY_ARCHETYPES,
    }


@app.post("/api/cards/body/compile-prompt")
async def compile_body_card_prompt_endpoint(payload: BodyCardDataPayload) -> dict[str, Any]:
    """Compile dictionary selections into standard 4:3 prompt template and Visual DNA."""
    prompt = compile_body_card_prompt(payload.data)
    visual_dna = compile_body_visual_dna(payload.data)
    return {
        "ok": True,
        "prompt": prompt,
        "visual_dna": visual_dna,
    }


@app.post("/api/cards/body/randomize")
async def randomize_body_card_endpoint(payload: BodyCardRandomizePayload | None = None) -> dict[str, Any]:
    """Generate a coherent randomized body dictionary payload with compiled prompt."""
    archetype = payload.archetype if payload else None
    data = randomize_body(archetype)
    prompt = compile_body_card_prompt(data)
    visual_dna = compile_body_visual_dna(data)
    return {
        "ok": True,
        "data": data,
        "prompt": prompt,
        "visual_dna": visual_dna,
    }


@app.post("/api/cards/body/generate")
async def generate_body_card_endpoint(payload: BodyCardGeneratePayload) -> dict[str, Any]:
    """Compile prompt and invoke 4:3 full-body image generation engine directly."""
    prompt = payload.prompt.strip() if payload.prompt and payload.prompt.strip() else compile_body_card_prompt(payload.data)
    visual_dna = compile_body_visual_dna(payload.data)
    req = ImageRequest(
        prompt=prompt,
        conversation_id=payload.conversation_id,
        metadata={
            "card_type": "body_identity",
            "body_data": payload.data,
            "visual_dna": visual_dna,
        },
    )
    result = await image(req)
    return {
        "ok": True,
        "result": result,
        "prompt": prompt,
        "visual_dna": visual_dna,
        "body_data": payload.data,
    }


class ExpressionCardGeneratePayload(BaseModel):
    data: dict[str, Any] = Field(default_factory=dict)
    conversation_id: str | None = None
    prompt: str | None = None


@app.post("/api/cards/expression/generate")
async def generate_expression_card_endpoint(payload: ExpressionCardGeneratePayload) -> dict[str, Any]:
    """Compile prompt and invoke 4:3 2x3 grid expression card image generation engine directly."""
    prompt = payload.prompt.strip() if payload.prompt and payload.prompt.strip() else payload.data.get("prompt", "")
    req = ImageRequest(
        prompt=prompt,
        conversation_id=payload.conversation_id,
        metadata={
            "card_type": "expression_identity",
            "expression_data": payload.data,
        },
    )
    result = await image(req)
    return {
        "ok": True,
        "result": result,
        "prompt": prompt,
        "expression_data": payload.data,
    }


async def _execute_director_sequence(shots: list[StoryboardShot]):
    conv_id = None
    for i, shot in enumerate(shots):
        await ws_broadcast({
            "type": "director_sequence_progress",
            "shot_index": i,
            "total_shots": len(shots),
            "status": "Generating...",
            "shot": shot.model_dump()
        })
        
        req = ImageRequest(
            prompt=shot.prompt,
            conversation_id=conv_id,
            metadata={"director_shot": shot.model_dump()}
        )
        
        try:
            res = await image(req)
            if "conversation_id" in res and res["conversation_id"]:
                conv_id = res["conversation_id"]
        except Exception as e:
            log.error(f"Director sequence error on shot {i}: {e}", exc_info=True)
            await ws_broadcast({
                "type": "director_sequence_error",
                "shot_index": i,
                "error": str(e)
            })
            break
            
        if i < len(shots) - 1:
            await asyncio.sleep(8)
            
    await ws_broadcast({
        "type": "director_sequence_progress",
        "status": "Complete",
        "shot_index": len(shots),
        "total_shots": len(shots)
    })

@app.post("/api/director/execute")
async def api_director_execute(req: DirectorExecuteRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(_execute_director_sequence, req.shots)
    return {"ok": True, "message": "Sequence execution started"}


@app.post("/api/director/plan", response_model=StoryboardPlan)
async def api_director_plan(req: DirectorPlanRequest):
    mgr = _get_character_manager()
    char = None
    if req.character_id:
        char = mgr.get(req.character_id)
    else:
        char = mgr.get_active_character()
            
    if not char:
        raise HTTPException(status_code=400, detail="No character specified or active")

    settings = _load_json(SETTINGS_FILE, {})
    base_url = settings.get("llm_base_url", "https://api.openai.com/v1")
    api_key = settings.get("llm_api_key", "")
    model = settings.get("llm_model", "gpt-4o")

    llm = OpenAICompatibleClient()
    engine = DirectorEngine(llm, base_url=base_url, api_key=api_key, model=model)
    try:
        plan = await engine.plan_storyboard(
            intent=req.intent,
            character=char,
            shot_count=req.shot_count,
            style_override=req.style_override
        )
        return plan
    except Exception as e:
        log.error(f"Director plan error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ── Storage & Telegram Cloud Vault API ──


_sync_progress: dict[str, Any] = {
    "running": False,
    "total": 0,
    "current": 0,
    "uploaded": 0,
    "thumbnails": 0,
    "evicted": 0,
    "error": None,
}


@app.get("/api/storage/status")
async def api_storage_status() -> dict:
    """Live metrics on cache budget, thumbnail usage, and Telegram cloud vault."""
    settings = await get_settings()
    quota_mb = int(settings.get("storage_quota_mb", DEFAULT_QUOTA_MB))
    idx = _load_json(META_FILE, {})
    stats = get_storage_stats(IMAGES_DIR, THUMBNAILS_DIR, idx, quota_mb=quota_mb)
    stats["telegram_storage_enabled"] = bool(settings.get("telegram_storage_enabled", False))
    stats["telegram_channel_id"] = settings.get("telegram_channel_id", "")
    stats["telegram_topic_data"] = settings.get("telegram_topic_data", 8)
    stats["telegram_topic_general"] = settings.get("telegram_topic_general", 1)
    stats["telegram_topic_backup"] = settings.get("telegram_topic_backup", 5)
    has_token = bool(settings.get("telegram_bot_token"))
    has_channel = bool(settings.get("telegram_channel_id"))
    stats["has_credentials"] = has_token and has_channel
    stats["sync_status"] = _sync_progress
    return stats


@app.post("/api/storage/test")
async def api_storage_test(body: TelegramTestRequest | None = None) -> dict:
    """Test Telegram bot connection and channel write access."""
    settings = await get_settings()
    token = (body and body.bot_token) or settings.get("telegram_bot_token", "")
    chat_id = (body and body.channel_id) or settings.get("telegram_channel_id", "")
    try:
        res = await verify_telegram_connection(token, chat_id)
        return res
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


@app.get("/api/storage/topics")
async def api_storage_topics() -> dict:
    """Discover forum topics or return configured topic thread IDs."""
    settings = await get_settings()
    token = settings.get("telegram_bot_token", "")
    chat_id = settings.get("telegram_channel_id", "")
    res = await discover_forum_topics(token, chat_id)
    # Allow settings overrides if configured
    if "topics" in res:
        if settings.get("telegram_topic_data"):
            res["topics"]["data"] = settings["telegram_topic_data"]
        if settings.get("telegram_topic_general"):
            res["topics"]["general"] = settings["telegram_topic_general"]
        if settings.get("telegram_topic_backup"):
            res["topics"]["backup"] = settings["telegram_topic_backup"]
    return res


@app.post("/api/storage/thumbnails/regenerate")
async def api_storage_regenerate_thumbnails() -> dict:
    """Regenerate crisp 720p HD WebP thumbnails for all local images."""
    count = regenerate_all_thumbnails(IMAGES_DIR, THUMBNAILS_DIR, max_size=720, quality=85, overwrite=True)
    return {"ok": True, "regenerated": count, "message": f"Regenerated {count} crisp HD thumbnails"}



async def _run_storage_sync():
    global _sync_progress
    settings = await get_settings()
    tg_token = settings.get("telegram_bot_token", "")
    tg_chat_id = settings.get("telegram_channel_id", "")
    quota_mb = int(settings.get("storage_quota_mb", DEFAULT_QUOTA_MB))

    idx = _load_json(META_FILE, {})
    all_keys = list(idx.keys())
    if IMAGES_DIR.exists():
        for p in IMAGES_DIR.glob("*.png"):
            if p.stem not in idx:
                all_keys.append(p.stem)

    _sync_progress["running"] = True
    _sync_progress["total"] = len(all_keys)
    _sync_progress["current"] = 0
    _sync_progress["uploaded"] = 0
    _sync_progress["thumbnails"] = 0
    _sync_progress["evicted"] = 0
    _sync_progress["error"] = None

    try:
        for stem in all_keys:
            png_path = IMAGES_DIR / f"{stem}.png"
            thumb_path = THUMBNAILS_DIR / f"{stem}.webp"

            # 1. Ensure thumbnail exists
            if not thumb_path.exists() and png_path.exists():
                try:
                    generate_thumbnail(png_path, dest_path=thumb_path)
                    _sync_progress["thumbnails"] += 1
                except Exception as e:
                    log.warning("Sync thumbnail failed for %s: %s", stem, e)

            # 2. Upload to Telegram if not already backed up
            item = idx.get(stem, {})
            if not item.get("tg_file_id") and png_path.exists() and tg_token and tg_chat_id:
                try:
                    prompt = item.get("prompt") or "Generated art"
                    caption = f"🎨 {prompt[:500]}"
                    data_topic_id = settings.get("telegram_topic_data", 8)
                    general_topic_id = settings.get("telegram_topic_general", 1)

                    # 2a. Upload lossless file to Data topic
                    tg_res = await upload_document_to_telegram(
                        token=tg_token,
                        chat_id=tg_chat_id,
                        file_path=png_path,
                        caption=caption,
                        message_thread_id=data_topic_id,
                    )
                    item["tg_file_id"] = tg_res.get("file_id")
                    item["tg_message_id"] = tg_res.get("message_id")
                    item["tg_channel_id"] = tg_chat_id
                    item["is_local"] = True
                    idx[stem] = item
                    _sync_progress["uploaded"] += 1

                    # 2b. Send pure visual photo to General topic
                    try:
                        await send_photo_to_telegram(
                            token=tg_token,
                            chat_id=tg_chat_id,
                            file_path=png_path,
                            caption=None,
                            message_thread_id=general_topic_id,
                        )
                    except Exception as pe:
                        log.warning("Sync sendPhoto to General failed for %s: %s", stem, pe)
                except Exception as e:
                    log.error("Sync upload failed for %s: %s", stem, e)
                # Polite pacing to respect Telegram rate limits
                await asyncio.sleep(0.8)

            _sync_progress["current"] += 1
            if _sync_progress["current"] % 5 == 0:
                async with _meta_lock:
                    _save_json(META_FILE, idx)
                await ws_broadcast({"type": "storage_sync_progress", "progress": _sync_progress})
                await asyncio.sleep(0.02)

        # 3. Post-sync eviction to quota (strict quota invariant)
        favs = set(_load_json(FAVS_FILE, []))
        evicted = evict_to_budget(IMAGES_DIR, quota_mb, favs, idx)
        _sync_progress["evicted"] = len(evicted)

        async with _meta_lock:
            _save_json(META_FILE, idx)
        await ws_broadcast({"type": "storage_sync_complete", "progress": _sync_progress})
    except Exception as exc:
        _sync_progress["error"] = str(exc)
        log.error("Storage sync failed: %s", exc)
    finally:
        _sync_progress["running"] = False


@app.post("/api/storage/sync")
async def api_storage_sync() -> dict:
    """Trigger background migration/sync of existing images to Telegram."""
    global _sync_progress
    if _sync_progress["running"]:
        return {"ok": False, "message": "Sync is already in progress", "progress": _sync_progress}
    asyncio.create_task(_run_storage_sync())
    return {"ok": True, "message": "Storage sync started in background"}


@app.get("/api/storage/sync/status")
async def api_storage_sync_status() -> dict:
    """Query progress of background storage sync."""
    return _sync_progress


async def perform_vault_manifest_backup(auto_pin: bool = True) -> dict[str, Any]:
    """Compile and upload the daily JSON manifest to Telegram Backup topic, pin it, and prune old snapshots."""
    from datetime import datetime, timezone
    settings = await get_settings()
    tg_token = settings.get("telegram_bot_token", "")
    tg_chat_id = settings.get("telegram_channel_id", "")
    backup_topic_id = settings.get("telegram_topic_backup", 5)

    if not (tg_token and tg_chat_id and settings.get("telegram_storage_enabled", False)):
        raise HTTPException(status_code=400, detail="Telegram storage is not configured or enabled")

    async with _meta_lock:
        manifest = generate_vault_manifest(IMAGES_DIR, META_FILE, FAVS_FILE)

    manifest_bytes = json.dumps(manifest, indent=2).encode("utf-8")
    now_dt = datetime.now(timezone.utc)
    date_str = now_dt.strftime("%Y-%m-%d_%H%M%S")
    date_readable = now_dt.strftime("%Y-%m-%d %H:%M UTC")
    filename = f"bridge_vault_manifest_{now_dt.strftime('%Y%m%d')}.json"
    caption = (
        f"📦 Bridge Vault Manifest\n"
        f"Date: {date_readable}\n"
        f"Items: {manifest['total_images']} | Favorites: {len(manifest['favorites'])}\n"
        f"Keys: tg_file_id, filename, md5"
    )

    upload_res = await upload_vault_manifest(
        token=tg_token,
        chat_id=tg_chat_id,
        manifest_bytes=manifest_bytes,
        filename=filename,
        caption=caption,
        auto_pin=auto_pin,
        message_thread_id=backup_topic_id,
    )

    msg_id = upload_res.get("message_id")
    file_id = upload_res.get("file_id")
    if msg_id:
        record_backup_history(
            history_file=VAULT_BACKUPS_FILE,
            message_id=msg_id,
            filename=filename,
            date_str=date_readable,
            count=manifest["total_images"],
            file_id=file_id,
        )
        # Auto-prune messages older than the last 7 daily snapshots (Strict FIFO)
        deleted = await prune_backup_history(tg_token, tg_chat_id, VAULT_BACKUPS_FILE, max_keep=7)
        if deleted:
            log.info("Pruned %d old vault backup manifests from Telegram (FIFO)", len(deleted))

    await ws_broadcast({"type": "vault_backup_complete", "backup": {
        "filename": filename,
        "date_str": date_readable,
        "total_images": manifest["total_images"],
    }})

    return {
        "ok": True,
        "message_id": msg_id,
        "file_id": file_id,
        "filename": filename,
        "date_str": date_readable,
        "total_images": manifest["total_images"],
        "favorites": len(manifest["favorites"]),
        "pinned": upload_res.get("pinned", False),
    }


async def perform_vault_manifest_restore() -> dict[str, Any]:
    """Download pinned manifest from Telegram and restore gallery index & favorites."""
    settings = await get_settings()
    tg_token = settings.get("telegram_bot_token", "")
    tg_chat_id = settings.get("telegram_channel_id", "")
    if not (tg_token and tg_chat_id):
        raise HTTPException(status_code=400, detail="Telegram credentials missing")

    pinned_doc = await get_pinned_manifest_doc(tg_token, tg_chat_id)
    file_id = None
    file_name = None
    if pinned_doc and pinned_doc.get("file_id"):
        file_id = pinned_doc["file_id"]
        file_name = pinned_doc.get("file_name")
    else:
        # Fallback to latest backup from history if pinned message lookup didn't yield doc
        history = get_backup_history(VAULT_BACKUPS_FILE)
        if history and history[-1].get("file_id"):
            file_id = history[-1]["file_id"]
            file_name = history[-1].get("filename")

    if not file_id:
        raise HTTPException(status_code=404, detail="No pinned or recorded vault manifest found in Telegram chat")

    raw_bytes = await download_file_from_telegram(tg_token, file_id)
    try:
        manifest_data = json.loads(raw_bytes.decode("utf-8"))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse manifest JSON: {e}")

    async with _meta_lock:
        res = restore_vault_manifest(manifest_data, META_FILE, FAVS_FILE)

    await ws_broadcast({"type": "vault_restored", "restored": res})
    return {
        "ok": True,
        "filename": file_name,
        "restored_images": res["restored_images"],
        "restored_favorites": res["restored_favorites"],
    }


async def _daily_vault_backup_worker():
    """Background task that ensures a vault manifest backup runs daily."""
    await asyncio.sleep(30)
    while True:
        try:
            settings = _load_json(SETTINGS_FILE, {})
            if (
                settings.get("telegram_storage_enabled")
                and settings.get("telegram_bot_token")
                and settings.get("telegram_channel_id")
            ):
                history = get_backup_history(VAULT_BACKUPS_FILE)
                now = time.time()
                last_time = history[-1]["timestamp"] if history else 0
                if (now - last_time) >= 86400:  # 24 hours
                    log.info("Running automated daily Telegram Vault manifest backup...")
                    await perform_vault_manifest_backup(auto_pin=True)
        except asyncio.CancelledError:
            break
        except Exception as e:
            log.warning("Daily vault backup worker error: %s", e)
        await asyncio.sleep(3600)  # Check hourly


@app.on_event("startup")
async def on_startup():
    """Application startup lifecycle: initialize workers and auto-restore if database is empty."""
    # 1. Start background daily vault backup worker
    asyncio.create_task(_daily_vault_backup_worker())

    # 2. Check if gallery is empty and Telegram credentials are set for zero-touch auto-restore
    try:
        idx = _load_json(META_FILE, {})
        settings = _load_json(SETTINGS_FILE, {})
        if (
            len(idx) == 0
            and settings.get("telegram_storage_enabled")
            and settings.get("telegram_bot_token")
            and settings.get("telegram_channel_id")
        ):
            log.info("Fresh server / empty gallery index detected on startup. Attempting auto-restore from Telegram Vault...")
            await perform_vault_manifest_restore()
    except Exception as e:
        log.info("Startup auto-restore skipped or failed: %s", e)


@app.post("/api/storage/backup")
async def api_storage_backup() -> dict[str, Any]:
    """Trigger manual vault manifest backup & upload to Telegram."""
    return await perform_vault_manifest_backup(auto_pin=True)


@app.post("/api/storage/restore")
async def api_storage_restore() -> dict[str, Any]:
    """Trigger manual restore of gallery index from pinned Telegram manifest."""
    return await perform_vault_manifest_restore()


@app.get("/api/storage/backups")
async def api_storage_backups() -> dict[str, Any]:
    """Query backup manifest history and latest status."""
    history = get_backup_history(VAULT_BACKUPS_FILE)
    return {
        "total_backups": len(history),
        "latest": history[-1] if history else None,
        "history": history[-7:],
    }


@app.get("/api/state")
async def get_client_state() -> dict:
    """Retrieve persisted UI client state (active tab, conversation, viewer modal, etc.)."""
    return _load_json(
        STATE_FILE,
        {
            "currentTab": "chat",
            "activeConvId": None,
            "viewerImageId": None,
            "lastUpdated": time.time(),
        },
    )


@app.post("/api/state")
async def save_client_state(state: dict = Body(...)) -> dict:
    """Persist UI client state so page reloads seamlessly restore full session context."""
    current = _load_json(STATE_FILE, {})
    current.update(state)
    current["lastUpdated"] = time.time()
    _save_json(STATE_FILE, current)
    return current


# ── Full-Text & Vector Search API ──


@app.get("/api/search")
async def api_search(q: str = Query(..., min_length=1)) -> list[dict]:
    """Search images by prompt and metadata with fuzzy matching."""
    idx = _load_json(META_FILE, {})
    query = q.lower().strip()
    matched = []
    for item in idx.values():
        score = 0
        prompt = (item.get("prompt") or "").lower()
        tw1 = (item.get("tweaked_prompt") or "").lower()
        tw2 = (item.get("tweaked_prompt_2") or "").lower()
        tags = " ".join(item.get("tags") or []).lower()

        if query in prompt:
            score += 10
        if query in tw1 or query in tw2:
            score += 5
        if query in tags:
            score += 8
        if any(term in prompt for term in query.split()):
            score += 2

        if score > 0:
            matched.append((score, item))

    matched.sort(key=lambda x: (x[0], x[1].get("created_at", 0)), reverse=True)
    return [m[1] for m in matched[:100]]


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
            "max_chats": getattr(core.pool, "max_chats", 25) if hasattr(core, "pool") else 25,
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


class CustomChipRequest(BaseModel):
    text: str


@app.get("/api/prompt-library")
async def get_prompt_library():
    """Retrieve standard categories and user custom preset chips."""
    return {
        "standard": _prompt_library.get_standard_categories(),
        "custom": _prompt_library.get_custom_chips(),
    }


@app.post("/api/prompt-library/custom")
async def add_custom_chip(req: CustomChipRequest):
    """Add a new custom preset chip."""
    chip_id = _prompt_library.add_custom_chip(req.text)
    return {"id": chip_id, "text": req.text}


@app.delete("/api/prompt-library/custom/{chip_id}")
async def delete_custom_chip(chip_id: str):
    """Delete a custom preset chip by ID."""
    _prompt_library.delete_custom_chip(chip_id)
    return {"status": "ok"}


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
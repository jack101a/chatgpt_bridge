"""FastAPI daemon exposing ChatGPT bridge as a universal REST service and companion web dashboard."""

from __future__ import annotations

import asyncio
import base64
import hashlib
import json
import logging
import os
import time
import urllib.parse
from pathlib import Path
from typing import Any

import httpx
log = logging.getLogger("chatgpt_bridge.daemon")

from fastapi import BackgroundTasks, Body, FastAPI, File, Form, HTTPException, Query, Request, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, PlainTextResponse, RedirectResponse, Response, StreamingResponse
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
from .llm_client import (
    DEFAULT_PROVIDERS,
    OpenAICompatibleClient,
    get_assignments_config,
    get_providers_config,
    mask_api_key,
    resolve_llm_execution,
)
from .characters import (
    CharacterCard,
    CharacterListResponse,
    CharacterManager,
    DeltaPromptRequest,
    DeltaPromptResponse,
    WardrobeItem,
    repair_json_string,
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
from .sanitizer import clean_and_enhance_prompt, wrap_verbatim_directive
try:
    from playwright.async_api import TimeoutError as PlaywrightTimeoutError
except Exception:  # pragma: no cover - playwright always present at runtime
    PlaywrightTimeoutError = Exception
from .errors import (
    AuthError,
    BridgeTimeoutError,
    DaemonUnreachableError,
    GenerationDeniedError,
    ShapeChangedError,
)

STATE_DIR = Path(os.environ.get("CHATGPT_BRIDGE_STATE", "~/.chatgpt-bridge")).expanduser()
DAEMON_JSON = STATE_DIR / "daemon.json"
IMAGES_DIR = STATE_DIR / "images"
UPLOADS_DIR = IMAGES_DIR / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
THUMBNAILS_DIR = STATE_DIR / "thumbnails"
META_FILE = STATE_DIR / "gallery_index.json"
FAVS_FILE = STATE_DIR / "favorites.json"
SETTINGS_FILE = STATE_DIR / "settings.json"
STATE_FILE = STATE_DIR / "client_state.json"
VAULT_BACKUPS_FILE = STATE_DIR / "vault_backups.json"
CHARACTERS_FILE = STATE_DIR / "characters.json"
CONTRACTS_FILE = STATE_DIR / "conversation_contracts.json"
PROMPT_LIBRARY_FILE = STATE_DIR / "prompt_library.json"
DASH_HTML = Path(__file__).parent / "dashboard.html"
FRONTEND_DIST = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"

_prompt_library = PromptLibrary(db_path=str(PROMPT_LIBRARY_FILE))
FRONTEND_DIST_ALT = Path(__file__).parent / "dist"


def _load_conversation_contracts() -> dict[str, dict[str, Any]]:
    if not CONTRACTS_FILE.exists():
        return {}
    try:
        data = json.loads(CONTRACTS_FILE.read_text(encoding="utf-8"))
        if isinstance(data, dict):
            return data
    except Exception:
        pass
    return {}


def _save_conversation_contracts(contracts: dict[str, dict[str, Any]]) -> None:
    CONTRACTS_FILE.parent.mkdir(parents=True, exist_ok=True)
    tmp = CONTRACTS_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(contracts, indent=2, ensure_ascii=False), encoding="utf-8")
    tmp.replace(CONTRACTS_FILE)


def _save_conversation_contract(cid: str, info: dict[str, Any]) -> None:
    contracts = _load_conversation_contracts()
    clean_id = cid.strip()
    existing = contracts.get(clean_id, {})
    existing.update(info)
    contracts[clean_id] = existing
    _save_conversation_contracts(contracts)


def _get_dist_dir() -> Path | None:
    if (FRONTEND_DIST / "index.html").exists():
        return FRONTEND_DIST
    if (FRONTEND_DIST_ALT / "index.html").exists():
        return FRONTEND_DIST_ALT
    return None


def _resolve_image_input(input_val: str | Path | None) -> Path | None:
    """Resolve an image input string (base64 data URI, HTTP URL, filename, or local path) to a local Path."""
    if not input_val:
        return None
    if isinstance(input_val, Path) and input_val.exists():
        return input_val
    raw = str(input_val).strip()
    if not raw:
        return None

    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

    # 1. Base64 Data URI: data:image/png;base64,iVBORw0KGgo...
    if raw.startswith("data:image/") and ";base64," in raw:
        try:
            header, b64_data = raw.split(";base64,", 1)
            ext = header.split("/")[1].split("+")[0].split(";")[0] or "png"
            if ext == "jpeg":
                ext = "jpg"
            img_bytes = base64.b64decode(b64_data)
            file_hash = hashlib.sha256(img_bytes).hexdigest()[:12]
            dest = UPLOADS_DIR / f"upload_{file_hash}.{ext}"
            if not dest.exists():
                dest.write_bytes(img_bytes)
            return dest
        except Exception as e:
            log.warning("Failed to decode base64 image data: %s", e)
            return None

    # 2. Remote HTTP/HTTPS URL
    if raw.startswith("http://") or raw.startswith("https://"):
        try:
            file_hash = hashlib.sha256(raw.encode()).hexdigest()[:12]
            parsed_path = urllib.parse.urlparse(raw).path
            ext = Path(parsed_path).suffix or ".png"
            dest = UPLOADS_DIR / f"url_{file_hash}{ext}"
            if not dest.exists():
                with httpx.Client(timeout=15.0) as client:
                    resp = client.get(raw)
                    if resp.status_code == 200:
                        dest.write_bytes(resp.content)
            if dest.exists():
                return dest
        except Exception as e:
            log.warning("Failed to download remote image %s: %s", raw, e)
            return None

    # 3. Existing filename or path in UPLOADS_DIR, IMAGES_DIR, or filesystem
    clean_ref = raw
    if clean_ref.startswith("/images/uploads/"):
        clean_ref = clean_ref[len("/images/uploads/"):]
    elif clean_ref.startswith("images/uploads/"):
        clean_ref = clean_ref[len("images/uploads/"):]
    elif clean_ref.startswith("/images/"):
        clean_ref = clean_ref[len("/images/"):]
    elif clean_ref.startswith("images/"):
        clean_ref = clean_ref[len("images/"):]

    candidates = [
        UPLOADS_DIR / clean_ref,
        UPLOADS_DIR / f"{clean_ref}.png",
        IMAGES_DIR / clean_ref,
        IMAGES_DIR / f"{clean_ref}.png",
        Path(raw),
        Path(raw).with_suffix(".png"),
    ]
    for c in candidates:
        if c.exists() and c.is_file():
            return c

    return None


START_TS = time.time()

# Port defaults to 8465, configurable via PORT or CHATGPT_BRIDGE_PORT
PORT = int(os.environ.get("PORT") or os.environ.get("CHATGPT_BRIDGE_PORT") or "8465")
HOST = os.environ.get("HOST", "0.0.0.0")

DOCS_DESCRIPTION = """
## 🔌 ChatGPT Bridge — Universal Local LLM & DALL-E Gateway

A high-performance gateway connecting **OpenCode**, **OpenClaw**, **Continue.dev**, **Cline / Roo Code**, **Aider**, and custom agents directly to ChatGPT.

### 🚀 Key Capabilities:
- **OpenAI-Compatible Drop-In (`/v1`)**: Connect external code IDEs at `http://localhost:8466/v1` with zero glue code.
- **Thinking Mode Support**: Toggle deep reasoning on Sol (`gpt-5-6-t-mini`) via `model="chatgpt-thinking"` or `thinking=true`.
- **Live Quota & Limit Tracking**: Inspect upstream plan constraints, remaining percentage, and reset timestamps via `GET /api/accounts/quota`.
- **DALL-E Image Generation**: Generate UI mockups and diagrams via `POST /image`.
- **Interactive Documentation**: Visit [`/docs`](http://localhost:8466/docs) in your browser for the full interactive developer sandbox.
"""

OPENAPI_TAGS = [
    {
        "name": "OpenAI Drop-In Gateway (/v1)",
        "description": "Zero-glue OpenAI-compatible completions and model discovery for OpenCode, OpenClaw, Continue.dev, Cline, and Aider.",
    },
    {
        "name": "Chat & Thinking Mode",
        "description": "Direct chat conversations with ChatGPT, session continuity, and deep reasoning toggle (Sol gpt-5-6-t-mini).",
    },
    {
        "name": "Image Generation",
        "description": "High-definition DALL-E image generation with reference image support and context editing.",
    },
    {
        "name": "Plan Quota & Limits",
        "description": "Real-time ChatGPT plan limits, usage percentage headroom, and rate-limit reset timers.",
    },
    {
        "name": "System Health & Telemetry",
        "description": "Liveness probes, browser status, and runtime telemetry.",
    },
]

app = FastAPI(
    title="ChatGPT Bridge API & IDE Hub",
    description=DOCS_DESCRIPTION,
    version="2.5.0",
    docs_url=None,
    redoc_url=None,
    openapi_tags=OPENAPI_TAGS,
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

# Concurrency Architecture: 2 Chat Lanes + 1 Dedicated Image Lane
_core: ChatGPT | None = None
_chat_semaphore = asyncio.Semaphore(2)
_image_semaphore = asyncio.Semaphore(1)
_operation_lock = asyncio.Lock()
_lock = _operation_lock
_meta_lock = asyncio.Lock()
_ws_clients: set[WebSocket] = set()

# Client-isolated conversation states: client_id -> conversation_id
_client_conversations: dict[str, str] = {}


def _extract_client_id(request: Request | None = None, explicit_client_id: str | None = None) -> str:
    """Extract and sanitize client ID from explicit field, headers, or Bearer auth."""
    if explicit_client_id and str(explicit_client_id).strip():
        return str(explicit_client_id).strip()
    if request is not None:
        cid = request.headers.get("x-client-id") or request.headers.get("x-project-id")
        if cid and cid.strip():
            return cid.strip()
        auth = request.headers.get("authorization", "").strip()
        if auth.lower().startswith("bearer "):
            token = auth[7:].strip()
            if token and token not in ("sk-local-bridge", "bridge-local-token", "default", "none"):
                return token
    return "default"

# Backpressure queue limits
MAX_QUEUED_CHATS = int(os.environ.get("CHATGPT_BRIDGE_MAX_QUEUED_CHATS", "20"))
MAX_QUEUED_IMAGES = int(os.environ.get("CHATGPT_BRIDGE_MAX_QUEUED_IMAGES", "10"))
_chat_queue_counter = 0
_image_queue_counter = 0


class AskRequest(BaseModel):
    prompt: str = Field(..., description="Prompt or message to send to ChatGPT")
    model: str | None = Field(default=None, description="Optional model specifier")
    conversation_id: str | None = Field(default=None, description="Optional conversation ID for continuity")
    thinking: bool = Field(default=False, description="Enable thinking mode (gpt-5-6 reasoning)")
    client_id: str | None = Field(default=None, description="Optional client/project ID (e.g. 'opencode', 'openclaw') for conversation isolation")
    image: str | None = Field(default=None, description="Optional base64 data URI, HTTP image URL, or image filename for vision analysis")
    images: list[str] | None = Field(default=None, description="Optional list of image data URIs, URLs, or filenames for vision analysis")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "prompt": "Write a Python script to monitor API rate limits.",
                    "model": "chatgpt",
                    "thinking": True,
                }
            ]
        }
    }


class ChatCompletionMessage(BaseModel):
    role: str = Field(default="user", description="Message role: 'system', 'user', or 'assistant'")
    content: Any = Field(default="", description="Message text content")


class ChatCompletionRequest(BaseModel):
    model: str = Field(
        default="chatgpt-thinking",
        description="Model to use: 'chatgpt', 'chatgpt-thinking', 'gpt-5-6-t-mini', or 'gpt-4o'",
    )
    messages: list[ChatCompletionMessage] = Field(
        default_factory=lambda: [
            ChatCompletionMessage(role="user", content="Hello! How can you help me code today?")
        ],
        description="List of conversation messages",
    )
    stream: bool = Field(default=False, description="Stream response tokens via Server-Sent Events (SSE)")
    temperature: float | None = Field(default=None, description="Sampling temperature")
    max_tokens: int | None = Field(default=None, description="Maximum tokens to generate")
    conversation_id: str | None = Field(default=None, description="Optional conversation ID to maintain state")
    thinking: bool | None = Field(default=None, description="Enable Sol deep reasoning mode")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "model": "chatgpt-thinking",
                    "messages": [
                        {"role": "system", "content": "You are a senior full-stack software engineer."},
                        {"role": "user", "content": "How do I configure OpenCode to use the ChatGPT Bridge?"}
                    ],
                    "stream": False,
                    "thinking": True,
                }
            ]
        }
    }


class ImageRequest(BaseModel):
    prompt: str = Field(..., description="Image prompt description")
    timeout_s: int = Field(default=360, ge=1, description="Timeout in seconds for generation")
    max_tries: int | None = Field(default=None, description="Max retries on refusal (defaults to server config, e.g. 10)")
    conversation_id: str | None = Field(default=None, description="Optional conversation ID for continuity")
    tweaked_prompt: str | None = Field(default=None, description="Optional softer prompt for retries 6-7")
    tweaked_prompt_2: str | None = Field(default=None, description="Optional further refined prompt for retries 8-10")
    reference_image: str | None = Field(default=None, description="Optional reference image ID or filename or URL to attach")
    reference_images: list[str] | None = Field(
        default=None,
        description="Optional multiple reference image IDs/filenames/URLs to attach simultaneously (Turn 0 Contract Handshake)",
    )
    client_id: str | None = Field(default=None, description="Optional client/project ID for continuity")
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
    director_model: str | None = None
    enhancer_model: str | None = None
    llm_director_model: str | None = None
    llm_enhancer_model: str | None = None
    custom_models: list[str] | None = None


class TelegramTestRequest(BaseModel):
    bot_token: str | None = None
    channel_id: str | None = None


class LLMConfigPayload(BaseModel):
    base_url: str | None = None
    api_key: str | None = None
    model: str | None = None
    director_model: str | None = None
    enhancer_model: str | None = None
    llm_base_url: str | None = None
    llm_api_key: str | None = None
    llm_model: str | None = None
    llm_director_model: str | None = None
    llm_enhancer_model: str | None = None
    custom_models: list[str] | None = None


class LLMTestRequest(BaseModel):
    base_url: str | None = None
    api_key: str | None = None
    llm_base_url: str | None = None
    llm_api_key: str | None = None


class PromptEnhanceRequest(BaseModel):
    prompt: str
    model: str | None = None
    provider_id: str | None = None


class ProviderConfigPayload(BaseModel):
    name: str | None = None
    base_url: str | None = None
    api_key: str | None = None
    enabled: bool | None = None
    custom_models: list[str] | None = None


class RoleAssignmentItem(BaseModel):
    provider_id: str
    model: str


class AssignmentsPayload(BaseModel):
    director: RoleAssignmentItem | None = None
    enhancer: RoleAssignmentItem | None = None



_character_manager: CharacterManager | None = None


def _get_character_manager() -> CharacterManager:
    global _character_manager
    if _character_manager is None:
        _character_manager = CharacterManager(file_path=CHARACTERS_FILE)
    return _character_manager


class CreateCharacterRequest(BaseModel):
    id: str | None = None
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

    @field_validator("character_lock", mode="before")
    @classmethod
    def validate_character_lock(cls, v: Any) -> dict[str, Any] | None:
        if v is None:
            return None
        if isinstance(v, str):
            return repair_json_string(v)
        if isinstance(v, dict):
            return v
        return None


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

    @field_validator("character_lock", mode="before")
    @classmethod
    def validate_character_lock(cls, v: Any) -> dict[str, Any] | None:
        if v is None:
            return None
        if isinstance(v, str):
            return repair_json_string(v)
        if isinstance(v, dict):
            return v
        return None


class LockCharacterPayload(BaseModel):
    locked: bool | None = None


class DirectorPlanRequest(BaseModel):
    intent: str = Field(..., description="The scene intent or story plot")
    shot_count: int = Field(default=5, description="Number of shots")
    character_id: str | None = Field(default=None, description="Optional character override. If omitted, uses active character")
    creative_guidance: str | None = Field(default=None, description="Optional camera POVs, angles, lighting, directing instructions")
    style_override: str | None = Field(default=None, description="Optional style override")
    model: str | None = Field(default=None, description="Optional LLM model override for generating the plan")
    provider_id: str | None = Field(default=None, description="Optional LLM provider ID override")


class DirectorExecuteRequest(BaseModel):
    shots: list[StoryboardShot] = Field(..., description="The list of shots to execute")
    character_id: str | None = Field(default=None, description="Optional character ID to bind")
    conversation_id: str | None = Field(default=None, description="Optional target conversation thread")
    screenplay_handshake: str | None = Field(
        default=None,
        description="Optional Turn 0 Screenplay Handshake to prime freeform or director thread"
    )
    plot: str | None = Field(default=None, description="Optional plot/scene arc for roleplay handshake")
    roleplay_info: str | None = Field(default=None, description="Optional roleplay instructions for roleplay handshake")


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

        def _on_browser_stopped():
            log.info("Browser stopped/idled: resetting active client conversation continuity.")
            _client_conversations.clear()

        if hasattr(_core, "on_stop_callbacks"):
            _core.on_stop_callbacks.append(_on_browser_stopped)

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


# ── Developer Documentation Endpoints ──


@app.get("/docs", include_in_schema=False)
@app.get("/api/docs/ui", include_in_schema=False)
async def scalar_docs() -> HTMLResponse:
    """Serve modern 3-column interactive developer documentation powered by Scalar."""
    content = """<!doctype html>
<html>
  <head>
    <title>ChatGPT Bridge API Reference</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2310b981'><path d='M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5'/></svg>" />
    <style>
      body { margin: 0; padding: 0; background: #0f172a; }
    </style>
  </head>
  <body>
    <script
      id="api-reference"
      data-url="/openapi.json"
      data-configuration='{"theme": "kepler", "darkMode": true, "showSidebar": true, "hideDownloadButton": false, "defaultHttpClient": {"targetKey": "shell", "clientKey": "curl"}}'>
    </script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
  </body>
</html>"""
    return HTMLResponse(content=content)


@app.get("/api/docs", include_in_schema=False)
@app.head("/api/docs", include_in_schema=False)
async def api_docs_entrypoint(request: Request):
    """Universal developer documentation gateway.
    
    - Browser (Accept: text/html): Redirects directly to the interactive /docs portal.
    - AI Agent / Markdown (Accept: text/markdown): Returns clean Markdown guide.
    - JSON / curl (Accept: application/json): Returns machine-readable API specifications and IDE presets.
    """
    accept = request.headers.get("accept", "").lower()
    if "text/html" in accept:
        return RedirectResponse(url="/docs", status_code=307)
    if "text/markdown" in accept:
        return await api_docs_raw()

    host = request.headers.get("host", f"localhost:{PORT}")
    return {
        "name": "ChatGPT Bridge API & IDE Hub",
        "version": "2.5.0",
        "base_url": f"http://{host}",
        "openai_compatible_base_url": f"http://{host}/v1",
        "interactive_docs_url": f"http://{host}/docs",
        "markdown_guide_url": f"http://{host}/api/docs/raw",
        "openapi_spec_url": f"http://{host}/openapi.json",
        "thinking_mode": {
            "supported": True,
            "engine": "Sol reasoning (gpt-5-6-t-mini)",
            "openai_model": "chatgpt-thinking",
            "native_flag": "thinking: true",
        },
        "endpoints": {
            "chat_completions": "POST /v1/chat/completions",
            "models": "GET /v1/models",
            "ask": "POST /api/ask",
            "quota": "GET /api/accounts/quota",
            "quota_refresh": "POST /api/accounts/quota/refresh",
            "switch_account": "POST /accounts/switch",
            "image": "POST /image",
            "health": "GET /health",
            "status": "GET /status",
        },
        "ide_presets": {
            "opencode": {
                "provider": "openai-compatible",
                "api_base": f"http://{host}/v1",
                "models": ["chatgpt-thinking", "chatgpt"],
            },
            "continue": {
                "provider": "openai",
                "apiBase": f"http://{host}/v1",
                "models": ["chatgpt-thinking", "chatgpt"],
            },
            "aider": f"aider --openai-api-base http://{host}/v1 --openai-api-key none --model chatgpt-thinking",
        },
    }


@app.get("/api/docs/raw", include_in_schema=False)
@app.get("/api/docs/markdown", include_in_schema=False)
async def api_docs_raw() -> PlainTextResponse:
    """Return the complete Markdown integration guide for terminal users, curl, or AI agents."""
    guide_path = Path(__file__).resolve().parent.parent.parent / "docs" / "IDE_INTEGRATION_GUIDE.md"
    if not guide_path.exists():
        guide_path = Path("/home/ubuntu/antigravity/radiant-newton/docs/IDE_INTEGRATION_GUIDE.md")

    if guide_path.exists():
        content = guide_path.read_text(encoding="utf-8")
        return PlainTextResponse(content, media_type="text/markdown; charset=utf-8")

    return PlainTextResponse("# ChatGPT Bridge API Documentation\nGuide file not found.", status_code=404)


# ── Dashboard SPA ──


@app.get("/", response_class=HTMLResponse, include_in_schema=False)
@app.get("/dashboard", response_class=HTMLResponse, include_in_schema=False)
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


@app.get("/health", tags=["System Health & Telemetry"], summary="Liveness Health Check")
async def health() -> dict:
    """Basic health check."""
    return {"ok": True}


@app.get("/status", tags=["System Health & Telemetry"], summary="Runtime System Status")
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


@app.post("/ask", tags=["Chat & Thinking Mode"], summary="Direct Chat (Legacy Alias)")
@app.post("/api/ask", tags=["Chat & Thinking Mode"], summary="Direct Chat with Sol Thinking Toggle")
async def ask(req: AskRequest, request: Request = None) -> dict:
    """Send a text prompt to ChatGPT and return the response."""
    global _chat_queue_counter
    client_id = _extract_client_id(request, getattr(req, "client_id", None))

    if _chat_queue_counter >= MAX_QUEUED_CHATS:
        raise HTTPException(
            status_code=429,
            detail={"error": "Chat queue saturated. Please retry after a few seconds.", "retry_after": 5},
            headers={"Retry-After": "5"},
        )

    if not req.conversation_id and client_id != "default" and client_id in _client_conversations:
        req.conversation_id = _client_conversations[client_id]

    _chat_queue_counter += 1
    try:
        async with _chat_semaphore:
            try:
                if req.conversation_id:
                    clean_cid = req.conversation_id.strip()
                    if clean_cid.lower() in ("new", "clean", "none", ""):
                        _get_core().new_chat()
                        req.conversation_id = "new"
                    else:
                        await _align_account_for_conversation(clean_cid)
                core = _get_core()
                resolved_imgs: list[Path] = []
                if getattr(req, "image", None):
                    p = _resolve_image_input(req.image)
                    if p and p not in resolved_imgs:
                        resolved_imgs.append(p)
                if getattr(req, "images", None):
                    for img_item in req.images:
                        p = _resolve_image_input(img_item)
                        if p and p not in resolved_imgs:
                            resolved_imgs.append(p)

                ask_kwargs: dict[str, Any] = {
                    "model": req.model,
                    "conversation_id": req.conversation_id,
                    "thinking": req.thinking,
                }
                if resolved_imgs:
                    if len(resolved_imgs) == 1:
                        ask_kwargs["image_path"] = resolved_imgs[0]
                    ask_kwargs["image_paths"] = resolved_imgs

                try:
                    res = await core.ask(req.prompt, **ask_kwargs)
                except TypeError as te:
                    if "thinking" in str(te):
                        ask_kwargs.pop("thinking", None)
                        res = await core.ask(req.prompt, **ask_kwargs)
                    else:
                        raise
                active_cid = res.get("conversation_id")
                if active_cid and client_id != "default":
                    _client_conversations[client_id] = active_cid
                return res
            except (AuthError, ShapeChangedError, BridgeTimeoutError, DaemonUnreachableError, PlaywrightTimeoutError) as exc:
                return _error_response(exc)
    finally:
        _chat_queue_counter = max(0, _chat_queue_counter - 1)


@app.get("/v1/models", tags=["OpenAI Drop-In Gateway (/v1)"], summary="List Available Models (OpenAI Standard)")
@app.get("/api/v1/models", tags=["OpenAI Drop-In Gateway (/v1)"], summary="List Available Models (API Alias)")
async def list_v1_models() -> dict:
    """OpenAI-compatible models listing for IDEs (OpenCode, OpenClaw, Continue, Cline, Aider)."""
    now = int(time.time())
    model_ids = [
        "chatgpt",
        "chatgpt-thinking",
    ]
    return {
        "object": "list",
        "data": [
            {
                "id": mid,
                "object": "model",
                "created": now,
                "owned_by": "chatgpt-bridge",
                "permission": [],
                "root": mid,
                "parent": None,
            }
            for mid in model_ids
        ],
    }


@app.post("/v1/chat/completions", tags=["OpenAI Drop-In Gateway (/v1)"], summary="OpenAI-Compatible Chat Completions")
@app.post("/api/v1/chat/completions", tags=["OpenAI Drop-In Gateway (/v1)"], summary="OpenAI-Compatible Chat Completions (API Alias)")
async def chat_completions(req: ChatCompletionRequest, request: Request = None):
    """OpenAI-compatible chat completions endpoint for external IDEs and agents.
    
    Compatible with OpenCode, OpenClaw, Continue.dev, Cline, Aider, LiteLLM,
    and the official `openai` SDK (`client.chat.completions.create(...)`).
    """
    use_thinking = False
    if req.thinking is not None:
        use_thinking = req.thinking
    elif any(kw in req.model.lower() for kw in ("think", "reason", "sol", "o3")):
        use_thinking = True

    system_prompts: list[str] = []
    conversation_turns: list[str] = []
    extracted_images: list[str] = []
    for msg in req.messages:
        content_val = msg.content
        if isinstance(content_val, list):
            turn_texts = []
            for item in content_val:
                if isinstance(item, dict):
                    if item.get("type") == "text":
                        turn_texts.append(item.get("text", ""))
                    elif item.get("type") == "image_url":
                        url_obj = item.get("image_url")
                        img_url_str = url_obj.get("url") if isinstance(url_obj, dict) else str(url_obj or "")
                        if img_url_str:
                            extracted_images.append(img_url_str)
                elif isinstance(item, str):
                    turn_texts.append(item)
            content_str = "\n".join(turn_texts)
        else:
            content_str = content_val if isinstance(content_val, str) else json.dumps(content_val)

        if msg.role == "system":
            system_prompts.append(content_str)
        elif msg.role in ("user", "assistant"):
            prefix = "User: " if msg.role == "user" else "Assistant: "
            conversation_turns.append(f"{prefix}{content_str}")

    parts: list[str] = []
    if system_prompts:
        parts.append("[System Context]\n" + "\n\n".join(system_prompts))

    if len(conversation_turns) == 1 and conversation_turns[0].startswith("User: "):
        parts.append(conversation_turns[0][6:])
    elif conversation_turns:
        parts.append("\n\n".join(conversation_turns))
    else:
        parts.append("Hello")

    prompt_text = "\n\n".join(parts)

    ask_req = AskRequest(
        prompt=prompt_text,
        model=req.model,
        conversation_id=req.conversation_id,
        thinking=use_thinking,
        images=extracted_images if extracted_images else None,
    )
    result = await ask(ask_req, request=request)
    if "error" in result:
        raise HTTPException(
            status_code=500,
            detail={"error": {"message": result.get("error"), "type": "bridge_error", "code": 500}},
        )

    response_text = result.get("response", "")
    created_ts = int(time.time())
    completion_id = f"chatcmpl-{hashlib.md5(f'{time.time()}-{prompt_text[:20]}'.encode()).hexdigest()[:12]}"

    if req.stream:
        async def sse_stream():
            first_chunk = {
                "id": completion_id,
                "object": "chat.completion.chunk",
                "created": created_ts,
                "model": req.model,
                "choices": [{"index": 0, "delta": {"role": "assistant"}, "finish_reason": None}],
            }
            yield f"data: {json.dumps(first_chunk)}\n\n"

            content_chunk = {
                "id": completion_id,
                "object": "chat.completion.chunk",
                "created": created_ts,
                "model": req.model,
                "choices": [{"index": 0, "delta": {"content": response_text}, "finish_reason": None}],
            }
            yield f"data: {json.dumps(content_chunk)}\n\n"

            stop_chunk = {
                "id": completion_id,
                "object": "chat.completion.chunk",
                "created": created_ts,
                "model": req.model,
                "choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}],
            }
            yield f"data: {json.dumps(stop_chunk)}\n\n"
            yield "data: [DONE]\n\n"

        return StreamingResponse(sse_stream(), media_type="text/event-stream")

    prompt_tokens = max(1, len(prompt_text) // 4)
    comp_tokens = max(1, len(response_text) // 4)
    return {
        "id": completion_id,
        "object": "chat.completion",
        "created": created_ts,
        "model": req.model,
        "choices": [
            {
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": response_text,
                },
                "finish_reason": "stop",
            }
        ],
        "usage": {
            "prompt_tokens": prompt_tokens,
            "completion_tokens": comp_tokens,
            "total_tokens": prompt_tokens + comp_tokens,
        },
        "thinking": use_thinking,
        "conversation_id": result.get("conversation_id"),
        "account_used": result.get("account_used"),
    }


@app.post("/image", tags=["Image Generation"], summary="Generate DALL-E Image with Auto-Retry")
async def image(req: ImageRequest, request: Request = None) -> dict:
    """Generate an image using ChatGPT/DALL-E with automatic retry."""
    global _image_queue_counter
    client_id = _extract_client_id(request, getattr(req, "client_id", None))
    if _image_queue_counter >= MAX_QUEUED_IMAGES:
        raise HTTPException(
            status_code=429,
            detail={"error": "Image generation queue saturated. Please retry after a few seconds.", "retry_after": 15},
            headers={"Retry-After": "15"},
        )

    t0 = time.time()
    await ws_broadcast({
        "type": "generation_progress",
        "status": "Submitting to engine…",
        "retry": 1,
    })
    _image_queue_counter += 1
    try:
        async with _image_semaphore:
            kwargs = {}
            if req.max_tries is not None:
                kwargs["max_retries"] = req.max_tries
            if req.conversation_id is not None:
                clean_cid = req.conversation_id.strip()
                if clean_cid.lower() in ("new", "clean", "none", ""):
                    _get_core().new_chat()
                    kwargs["conversation_id"] = "new"
                else:
                    kwargs["conversation_id"] = clean_cid
                    await _align_account_for_conversation(clean_cid)
            elif client_id != "default" and f"img_{client_id}" in _client_conversations:
                kwargs["conversation_id"] = _client_conversations[f"img_{client_id}"]
            if req.tweaked_prompt is not None:
                kwargs["tweaked_prompt"] = req.tweaked_prompt
            if req.tweaked_prompt_2 is not None:
                kwargs["tweaked_prompt_2"] = req.tweaked_prompt_2
            resolved_paths: list[Path] = []
            if req.reference_images:
                for r_item in req.reference_images:
                    p = _resolve_image_input(r_item)
                    if p and p not in resolved_paths:
                        resolved_paths.append(p)

            if req.reference_image:
                p = _resolve_image_input(req.reference_image)
                if p and p not in resolved_paths:
                    resolved_paths.append(p)

            if len(resolved_paths) == 1:
                kwargs["image_path"] = resolved_paths[0]
            elif len(resolved_paths) > 1:
                kwargs["image_paths"] = resolved_paths

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

            img_cid = result.get("conversation_id")
            if img_cid and client_id != "default":
                _client_conversations[f"img_{client_id}"] = img_cid
            return result
    except (AuthError, ShapeChangedError, BridgeTimeoutError, DaemonUnreachableError, GenerationDeniedError, PlaywrightTimeoutError) as exc:
        return _error_response(exc)
    finally:
        _image_queue_counter = max(0, _image_queue_counter - 1)


@app.get("/images/{filename}", tags=["Image Generation"], summary="Retrieve Generated Image PNG")
@app.head("/images/{filename}", include_in_schema=False)
async def get_image(filename: str):
    file_path = IMAGES_DIR / filename
    if not (file_path.exists() and file_path.is_file()) and not filename.endswith(".png"):
        file_path = IMAGES_DIR / f"{filename}.png"
    if file_path.exists() and file_path.is_file():
        return FileResponse(file_path, media_type="image/png")

    # If requested image has an upload/edit/url prefix, check uploads directory
    if filename.startswith(("upload_", "url_", "edit_")):
        uploads_dir = IMAGES_DIR / "uploads"
        upload_path = uploads_dir / filename
        if not (upload_path.exists() and upload_path.is_file()) and not filename.endswith(".png"):
            upload_path = uploads_dir / f"{filename}.png"
        if upload_path.exists() and upload_path.is_file():
            return FileResponse(upload_path, media_type="image/png")

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


@app.get("/images/uploads/{filename}", tags=["Image Generation"], summary="Retrieve Uploaded Image")
@app.head("/images/uploads/{filename}", include_in_schema=False)
async def get_uploaded_image(filename: str):
    uploads_dir = IMAGES_DIR / "uploads"
    file_path = uploads_dir / filename
    if not (file_path.exists() and file_path.is_file()) and not filename.endswith(".png"):
        file_path = uploads_dir / f"{filename}.png"
    if file_path.exists() and file_path.is_file():
        return FileResponse(file_path, media_type="image/png")
    raise HTTPException(status_code=404, detail="Uploaded image not found")


@app.post("/api/upload", tags=["Image Generation"], summary="Upload Reference Image for Editing or Vision")
async def upload_image(
    file: UploadFile = File(None),
    data: str | None = Form(None),
    filename: str | None = Form(None),
    request: Request = None,
) -> dict:
    """Upload an image file (multipart/form-data) or base64 data to use as a reference for image editing or vision."""
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    img_bytes: bytes | None = None
    orig_name = filename or "uploaded_image.png"

    if file is not None:
        img_bytes = await file.read()
        orig_name = file.filename or orig_name
    elif data:
        raw = data.strip()
        if raw.startswith("data:image/") and ";base64," in raw:
            _, b64_part = raw.split(";base64,", 1)
            try:
                img_bytes = base64.b64decode(b64_part)
            except Exception:
                pass
        else:
            try:
                img_bytes = base64.b64decode(raw)
            except Exception:
                pass

    if not img_bytes and request is not None and request.headers.get("content-type", "").startswith("application/json"):
        try:
            body = await request.json()
            if isinstance(body, dict):
                raw = body.get("data") or body.get("image") or ""
                orig_name = body.get("filename") or orig_name
                if raw.startswith("data:image/") and ";base64," in raw:
                    _, b64_part = raw.split(";base64,", 1)
                    img_bytes = base64.b64decode(b64_part)
                elif raw:
                    try:
                        img_bytes = base64.b64decode(raw)
                    except Exception:
                        pass
        except Exception:
            pass

    if not img_bytes:
        raise HTTPException(status_code=400, detail="No image file or valid base64 data provided.")

    file_hash = hashlib.sha256(img_bytes).hexdigest()[:12]
    ext = Path(orig_name).suffix.lower()
    if ext not in (".png", ".jpg", ".jpeg", ".webp", ".gif"):
        ext = ".png"
    dest_name = f"upload_{file_hash}{ext}"
    dest = UPLOADS_DIR / dest_name
    dest.write_bytes(img_bytes)

    host = request.headers.get("host", "localhost:8466") if request else "localhost:8466"
    return {
        "ok": True,
        "id": f"upload_{file_hash}",
        "filename": dest_name,
        "url": f"/images/uploads/{dest_name}",
        "full_url": f"http://{host}/images/uploads/{dest_name}",
        "size_bytes": len(img_bytes),
    }


@app.post("/v1/images/edits", tags=["OpenAI Drop-In Gateway (/v1)"], summary="OpenAI-Compatible Image Edits")
@app.post("/api/v1/images/edits", tags=["OpenAI Drop-In Gateway (/v1)"], summary="OpenAI-Compatible Image Edits (API Alias)")
async def images_edits(
    image_file: UploadFile = File(None, alias="image"),
    prompt: str = Form(None),
    mask: UploadFile = File(None),
    model: str | None = Form(None),
    n: int | None = Form(1),
    size: str | None = Form("1024x1024"),
    response_format: str | None = Form("url"),
    user: str | None = Form(None),
    request: Request = None,
):
    """OpenAI standard image edits endpoint.
    
    Accepts multipart/form-data or JSON (matching client.images.edit(...) in OpenAI SDK).
    """
    img_bytes: bytes | None = None
    prompt_text = prompt

    if image_file is not None:
        img_bytes = await image_file.read()

    # Support JSON if sent as application/json
    if not img_bytes and request is not None and request.headers.get("content-type", "").startswith("application/json"):
        try:
            body = await request.json()
            if isinstance(body, dict):
                prompt_text = body.get("prompt", prompt_text)
                model = body.get("model", model)
                response_format = body.get("response_format", response_format)
                raw_img = body.get("image", "")
                if raw_img.startswith("data:image/") and ";base64," in raw_img:
                    _, b64 = raw_img.split(";base64,", 1)
                    img_bytes = base64.b64decode(b64)
                elif raw_img:
                    try:
                        img_bytes = base64.b64decode(raw_img)
                    except Exception:
                        pass
        except Exception:
            pass

    if not prompt_text:
        raise HTTPException(status_code=400, detail={"error": {"message": "Prompt is required for image editing", "type": "invalid_request_error"}})
    if not img_bytes:
        raise HTTPException(status_code=400, detail={"error": {"message": "Image file is required for image editing", "type": "invalid_request_error"}})

    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    file_hash = hashlib.sha256(img_bytes).hexdigest()[:12]
    upload_path = UPLOADS_DIR / f"edit_{file_hash}.png"
    upload_path.write_bytes(img_bytes)

    img_req = ImageRequest(
        prompt=prompt_text,
        reference_image=str(upload_path),
    )
    res = await image(img_req, request=request)
    if "error" in res:
        raise HTTPException(status_code=500, detail={"error": {"message": res.get("error"), "type": "bridge_error"}})

    host = request.headers.get("host", "localhost:8466") if request else "localhost:8466"
    img_url = res.get("image_url") or ""
    if not img_url.startswith("http"):
        img_url = f"http://{host}{img_url}"

    created_ts = int(time.time())
    data_items = []
    if (response_format or "").lower() == "b64_json":
        p_name = res.get("image_url", "").split("/")[-1]
        p_path = IMAGES_DIR / p_name
        if p_path.exists():
            b64_encoded = base64.b64encode(p_path.read_bytes()).decode()
            data_items.append({"b64_json": b64_encoded})
        else:
            data_items.append({"url": img_url})
    else:
        data_items.append({"url": img_url})

    return {
        "created": created_ts,
        "data": data_items,
    }


@app.get("/thumbnails/{filename}", tags=["Image Generation"], summary="Retrieve Image Thumbnail WebP")
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


@app.post("/conversations/new", tags=["Chat & Thinking Mode"], summary="Reset Conversation Continuity")
async def reset_conversation(request: Request = None) -> dict:
    """Reset the current conversation continuity so subsequent requests start a fresh thread."""
    client_id = _extract_client_id(request)
    if client_id in _client_conversations:
        _client_conversations.pop(client_id, None)
    if f"img_{client_id}" in _client_conversations:
        _client_conversations.pop(f"img_{client_id}", None)
    core = _get_core()
    if hasattr(core, "new_chat"):
        core.new_chat()
    return {"ok": True, "message": "Conversation thread reset"}


@app.delete("/conversation/{conversation_id}", include_in_schema=False)
@app.delete("/conversations/{conversation_id}", include_in_schema=False)
@app.post("/conversation/{conversation_id}/delete", include_in_schema=False)
async def delete_conversation(conversation_id: str) -> dict:
    """Delete a conversation from history."""
    async with _lock:
        try:
            ok = await _get_core().delete_conversation(conversation_id)
            return {"ok": ok, "conversation_id": conversation_id}
        except Exception as exc:
            return _error_response(exc)


# ── Accounts Management ──


@app.get("/accounts", include_in_schema=False)
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
            "quota": getattr(a, "quota", None),
        }
        for a in mgr.accounts.values()
    ]
    return {"active_account_id": mgr.active_account_id, "accounts": accs}


@app.get("/api/accounts", include_in_schema=False)
async def api_accounts() -> list[dict]:
    """Direct account list for UI consumption."""
    res = await list_accounts()
    return res.get("accounts", [])


@app.get("/api/accounts/quota", tags=["Plan Quota & Limits"], summary="Fetch Real-Time ChatGPT Plan Quota")
async def get_account_quota(account: str | None = None) -> dict:
    """Fetch real-time quota and limits for active (or specified) account from ChatGPT."""
    core = _get_core()
    try:
        quota = await core.fetch_account_quota(account_id_or_alias=account)
        return {"ok": True, "quota": quota}
    except Exception as exc:
        log.warning("Failed to fetch account quota: %s", exc)
        return {"ok": False, "error": str(exc)}


@app.post("/api/accounts/quota/refresh", tags=["Plan Quota & Limits"], summary="Force Refresh Plan Quota from Web Session")
async def refresh_account_quota(account: str | None = None) -> dict:
    """Force refresh quota and limits directly from ChatGPT upstream."""
    core = _get_core()
    try:
        quota = await core.fetch_account_quota(account_id_or_alias=account, force_refresh=True)
        acc_name = account or core.account_manager.active_account_id
        await ws_broadcast({"type": "account_quota_updated", "account": acc_name, "quota": quota})
        return {"ok": True, "quota": quota}
    except Exception as exc:
        log.warning("Failed to refresh account quota: %s", exc)
        return {"ok": False, "error": str(exc)}


@app.post("/accounts/switch", include_in_schema=False)
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


@app.post("/api/accounts/cookies", include_in_schema=False)
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


@app.get("/api/gallery", response_model=GalleryPage, include_in_schema=False)
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


@app.get("/api/gallery/{gid}", response_model=GalleryItem, include_in_schema=False)
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


@app.post("/api/gallery/{gid}/favorite", include_in_schema=False)
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


@app.delete("/api/gallery/{gid}", include_in_schema=False)
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


@app.get("/api/chats", response_model=list[ChatSummary], include_in_schema=False)
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


@app.post("/api/chats/purge_stale", include_in_schema=False)
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


@app.get("/api/settings", include_in_schema=False)
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


@app.patch("/api/settings", include_in_schema=False)
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
    if p.director_model is not None:
        s["director_model"] = p.director_model.strip()
        s["llm_model"] = p.director_model.strip()
    elif p.llm_director_model is not None:
        s["director_model"] = p.llm_director_model.strip()
        s["llm_model"] = p.llm_director_model.strip()
    elif p.llm_model is not None:
        s["director_model"] = p.llm_model.strip()
        s["llm_model"] = p.llm_model.strip()
    if p.enhancer_model is not None:
        s["enhancer_model"] = p.enhancer_model.strip()
    elif p.llm_enhancer_model is not None:
        s["enhancer_model"] = p.llm_enhancer_model.strip()
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

CHATGPT25_ENHANCER_SYSTEM_PROMPT = """You are an expert visual director and prompt engineer specializing in ChatGPT Images 2.5 / GPT-Image-2.5.
Your task: Transform the user's idea into a vivid, highly detailed, evocative natural language prompt tailored specifically to their concept.

CORE ARCHITECTURE:
1. DYNAMIC MEDIUM & STYLE MATCHING:
   - Identify the user's intended artistic medium or aesthetic.
   - If a specific style is requested (e.g. candid iPhone snapshot, direct on-camera flash digicam, studio strobe portrait, vintage Polaroid, 35mm film still, anime, watercolor, digital concept art, architectural photography), enhance organically within that specific visual language.
   - If no style is specified, default to authentic, lifelike photographic realism with natural depth and tactile textures. Do NOT force "Hollywood cinema" or "35mm film grain" onto casual, modern, or non-cinematic concepts.

2. DETAILED NATURAL LANGUAGE PROSE:
   - Write rich, immersive descriptive prose with natural sentence flow. Never use robotic comma-separated keyword lists.
   - Open naturally with the camera framing, perspective, or spatial staging (e.g. wide environmental view, intimate eye-level portrait, candid low angle, top-down view).
   - Describe lighting dynamics truthfully (natural window daylight, golden ambient bounce, neon reflection, soft studio fill, or direct flash).
   - Detail authentic physical interactions, subject action, expression, tactile fabric drape, and environmental depth.

3. PROPORTIONAL & CONTEXTUAL EXPANSION:
   - For short or minimal inputs (1–15 words): Dynamically flesh out the scene with atmospheric depth, composition, lighting, and textures (~90–160 words).
   - For detailed inputs: Preserve and honor ALL user-specified subjects, wardrobe, actions, and settings. Polish and elevate the sensory clarity without cutting out user details or imposing an arbitrary word limit.

4. ORGANIC REALISM WITHOUT FORMULAIC CLICHÉS:
   - FORBID repeating stock boilerplate phrases (never repeat "completely free of waxy plastic smoothing", "realistic textile weave", or "photorealistic").
   - Instead, convey realism through concrete physical interactions: light catching individual hair strands, subtle natural skin pores, realistic shadow falloff, texture of materials, and authentic lens depth.

5. OUTPUT:
   - Return ONLY the clean enhanced prompt text. No quotes, no markdown wrappers, no conversational filler."""


@app.get("/api/llm/config", include_in_schema=False)
async def get_llm_config() -> dict:
    """Retrieve OpenAI-compatible LLM configuration with masked API key."""
    settings = _load_json(SETTINGS_FILE, {})
    raw_key = settings.get("llm_api_key") or os.environ.get("LLM_API_KEY") or os.environ.get("OPENAI_API_KEY", "")
    base_url = settings.get("llm_base_url") or os.environ.get("LLM_BASE_URL") or os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1")
    director_model = settings.get("director_model") or settings.get("llm_director_model") or settings.get("llm_model") or os.environ.get("LLM_DIRECTOR_MODEL") or os.environ.get("LLM_MODEL", "gpt-4o")
    enhancer_model = settings.get("enhancer_model") or settings.get("llm_enhancer_model") or os.environ.get("LLM_ENHANCER_MODEL") or director_model
    custom_models = settings.get("custom_models", [])
    masked = mask_api_key(raw_key)

    return {
        "base_url": base_url,
        "api_key": masked,
        "model": director_model,
        "director_model": director_model,
        "enhancer_model": enhancer_model,
        "custom_models": custom_models,
        "has_key": bool(raw_key),
        "llm_base_url": base_url,
        "llm_api_key": masked,
        "llm_model": director_model,
        "llm_director_model": director_model,
        "llm_enhancer_model": enhancer_model,
    }


@app.post("/api/llm/config", include_in_schema=False)
async def post_llm_config(payload: LLMConfigPayload) -> dict:
    """Update OpenAI-compatible LLM configuration in settings.json."""
    settings = _load_json(SETTINGS_FILE, {})

    new_base_url = payload.base_url if payload.base_url is not None else payload.llm_base_url
    new_api_key = payload.api_key if payload.api_key is not None else payload.llm_api_key
    new_director_model = (
        payload.director_model
        if payload.director_model is not None
        else (payload.llm_director_model if payload.llm_director_model is not None else (payload.model if payload.model is not None else payload.llm_model))
    )
    new_enhancer_model = payload.enhancer_model if payload.enhancer_model is not None else payload.llm_enhancer_model

    if new_base_url is not None:
        settings["llm_base_url"] = new_base_url.strip()
    if new_api_key is not None:
        key_str = new_api_key.strip()
        if "****" not in key_str:
            settings["llm_api_key"] = key_str
    if new_director_model is not None:
        settings["director_model"] = new_director_model.strip()
        settings["llm_model"] = new_director_model.strip()
    if new_enhancer_model is not None:
        settings["enhancer_model"] = new_enhancer_model.strip()
    if payload.custom_models is not None:
        cleaned_custom = []
        seen = set()
        for m in payload.custom_models:
            s = str(m).strip()
            if s and s not in seen:
                seen.add(s)
                cleaned_custom.append(s)
        settings["custom_models"] = cleaned_custom

    _save_json(SETTINGS_FILE, settings)

    raw_key = settings.get("llm_api_key", "")
    base_url = settings.get("llm_base_url", "https://api.openai.com/v1")
    director_model = settings.get("director_model") or settings.get("llm_model", "gpt-4o")
    enhancer_model = settings.get("enhancer_model", director_model)
    custom_models = settings.get("custom_models", [])
    masked = mask_api_key(raw_key)

    return {
        "ok": True,
        "base_url": base_url,
        "api_key": masked,
        "model": director_model,
        "director_model": director_model,
        "enhancer_model": enhancer_model,
        "custom_models": custom_models,
        "has_key": bool(raw_key),
        "llm_base_url": base_url,
        "llm_api_key": masked,
        "llm_model": director_model,
        "llm_director_model": director_model,
        "llm_enhancer_model": enhancer_model,
    }


@app.get("/api/llm/models", include_in_schema=False)
async def get_llm_models(base_url: str | None = None, api_key: str | None = None) -> dict:
    """Fetch live available models from the specified or configured LLM endpoint."""
    settings = _load_json(SETTINGS_FILE, {})
    effective_base = (base_url.strip() if base_url else "") or settings.get("llm_base_url") or os.environ.get("LLM_BASE_URL") or os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1")

    if api_key and "****" not in api_key:
        effective_key = api_key.strip()
    else:
        effective_key = settings.get("llm_api_key") or os.environ.get("LLM_API_KEY") or os.environ.get("OPENAI_API_KEY", "")

    custom_models = settings.get("custom_models", [])
    client = OpenAICompatibleClient()
    ok, message, models = await client.test_connection(base_url=effective_base, api_key=effective_key)
    return {
        "ok": ok,
        "message": message,
        "models": models,
        "custom_models": custom_models,
        "base_url": effective_base,
    }


class AddCustomModelPayload(BaseModel):
    model: str


@app.post("/api/llm/custom-models", include_in_schema=False)
async def post_custom_model(payload: AddCustomModelPayload) -> dict:
    """Add a custom user-defined model from any provider."""
    model_name = payload.model.strip()
    if not model_name:
        raise HTTPException(status_code=400, detail="Model name cannot be empty")
    settings = _load_json(SETTINGS_FILE, {})
    custom: list[str] = list(settings.get("custom_models") or [])
    if model_name not in custom:
        custom.append(model_name)
        settings["custom_models"] = custom
        _save_json(SETTINGS_FILE, settings)
    return {"ok": True, "custom_models": custom, "added": model_name}


@app.delete("/api/llm/custom-models/{model_name:path}", include_in_schema=False)
async def delete_custom_model(model_name: str) -> dict:
    """Delete a custom user-defined model from the saved list."""
    settings = _load_json(SETTINGS_FILE, {})
    custom: list[str] = list(settings.get("custom_models") or [])
    if model_name in custom:
        custom = [m for m in custom if m != model_name]
        settings["custom_models"] = custom
        _save_json(SETTINGS_FILE, settings)
    return {"ok": True, "custom_models": custom, "removed": model_name}


@app.post("/api/llm/test", include_in_schema=False)
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


@app.post("/api/prompt/enhance", include_in_schema=False)
async def post_prompt_enhance(payload: PromptEnhanceRequest) -> dict:
    """Enhance a user prompt using ChatGPT 2.5 prompt engineering via configured LLM."""
    if not payload.prompt.strip():
        raise HTTPException(status_code=400, detail="Empty prompt")

    settings = _load_json(SETTINGS_FILE, {})
    req_model = payload.model
    if req_model and "gemma" in req_model.lower():
        req_model = "gemini-2.5-flash"

    base_url, api_key, model, provider_id = resolve_llm_execution(
        settings,
        role="enhancer",
        requested_provider_id=payload.provider_id,
        requested_model=req_model,
    )
    if "gemma" in model.lower():
        model = "gemini-2.5-flash"

    client = OpenAICompatibleClient()
    messages = [
        {"role": "system", "content": CHATGPT25_ENHANCER_SYSTEM_PROMPT},
        {"role": "user", "content": f"Transform and enrich this concept into an evocative, highly detailed natural language prompt matching its intended medium:\n\n{payload.prompt.strip()}"},
    ]

    # Attempt primary model with immediate 1-retry on transient failure
    for attempt in range(2):
        try:
            enhanced = await client.chat_completion(
                base_url=base_url,
                api_key=api_key,
                model=model,
                messages=messages,
                temperature=0.7,
                timeout=25.0,
            )
            cleaned = enhanced.strip().strip('"').strip("'")
            if cleaned:
                return {
                    "ok": True,
                    "enhanced_prompt": cleaned,
                    "model_used": model,
                    "provider_used": provider_id,
                }
        except Exception as exc:
            log.warning(f"AI Prompt enhancement attempt {attempt + 1} failed with model {model} on {provider_id}: {exc}")
            if attempt == 0:
                await asyncio.sleep(1.0)

    # Fallback to alternative Gemini models if primary was not already exhausted or if another model is available
    fallback_models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"]
    for fb_model in fallback_models:
        if fb_model == model and provider_id == "gemini":
            continue
        try:
            g_base, g_key, _, _ = resolve_llm_execution(
                settings,
                role="enhancer",
                requested_provider_id="gemini",
                requested_model=fb_model,
            )
            if not g_key:
                break
            enhanced = await client.chat_completion(
                base_url=g_base,
                api_key=g_key,
                model=fb_model,
                messages=messages,
                temperature=0.7,
                timeout=25.0,
            )
            cleaned = enhanced.strip().strip('"').strip("'")
            if cleaned:
                return {
                    "ok": True,
                    "enhanced_prompt": cleaned,
                    "model_used": fb_model,
                    "provider_used": "gemini",
                }
        except Exception as exc_fb:
            log.warning(f"Alternative fallback model {fb_model} failed: {exc_fb}")

    # Guaranteed rule-based fallback so user always gets an enhanced prompt
    fallback_prompt = clean_and_enhance_prompt(payload.prompt.strip(), add_anti_plastic=True)
    return {
        "ok": True,
        "enhanced_prompt": fallback_prompt,
        "model_used": "rule_based_fallback",
        "provider_used": "local",
    }


# ── AI Multi-Provider & Work Assignment Architecture ──


@app.get("/api/ai/config", include_in_schema=False)
async def get_ai_config() -> dict:
    """Retrieve multi-provider configurations, role assignments, and standard presets."""
    settings = _load_json(SETTINGS_FILE, {})
    providers = get_providers_config(settings)
    assignments = get_assignments_config(settings)

    safe_providers: dict[str, Any] = {}
    for pid, pdata in providers.items():
        p_copy = dict(pdata)
        raw_key = pdata.get("api_key", "")
        p_copy["has_key"] = bool(raw_key)
        p_copy["api_key"] = mask_api_key(raw_key)
        safe_providers[pid] = p_copy

    return {
        "ok": True,
        "providers": safe_providers,
        "assignments": assignments,
        "default_providers": DEFAULT_PROVIDERS,
    }


@app.post("/api/ai/providers/{provider_id}", include_in_schema=False)
async def post_ai_provider(provider_id: str, payload: ProviderConfigPayload) -> dict:
    """Save or update configuration for a specific provider."""
    pid = provider_id.strip()
    if not pid:
        raise HTTPException(status_code=400, detail="Provider ID cannot be empty")

    settings = _load_json(SETTINGS_FILE, {})
    providers = get_providers_config(settings)

    current = providers.get(pid, {
        "name": payload.name or pid.title(),
        "base_url": payload.base_url or "https://api.openai.com/v1",
        "api_key": "",
        "enabled": True,
        "custom_models": [],
        "discovered_models": [],
    })

    if payload.name is not None:
        current["name"] = payload.name.strip()
    if payload.base_url is not None:
        current["base_url"] = payload.base_url.strip()
    if payload.api_key is not None:
        raw_key = payload.api_key.strip()
        if "****" not in raw_key:
            current["api_key"] = raw_key
    if payload.enabled is not None:
        current["enabled"] = bool(payload.enabled)
    if payload.custom_models is not None:
        cleaned_custom = []
        seen = set()
        for m in payload.custom_models:
            s = str(m).strip()
            if s and s not in seen:
                seen.add(s)
                cleaned_custom.append(s)
        current["custom_models"] = cleaned_custom

    providers[pid] = current
    settings["providers"] = providers
    _save_json(SETTINGS_FILE, settings)

    safe_copy = dict(current)
    safe_copy["has_key"] = bool(current.get("api_key"))
    safe_copy["api_key"] = mask_api_key(current.get("api_key", ""))

    safe_all: dict[str, Any] = {}
    for k, v in providers.items():
        v_copy = dict(v)
        v_copy["has_key"] = bool(v.get("api_key"))
        v_copy["api_key"] = mask_api_key(v.get("api_key", ""))
        safe_all[k] = v_copy

    return {
        "ok": True,
        "provider": safe_copy,
        "provider_id": pid,
        "providers": safe_all,
    }


@app.delete("/api/ai/providers/{provider_id}", include_in_schema=False)
async def delete_ai_provider(provider_id: str) -> dict:
    """Delete a custom AI provider."""
    pid = provider_id.strip()
    settings = _load_json(SETTINGS_FILE, {})
    providers = get_providers_config(settings)
    if pid in providers:
        del providers[pid]
        settings["providers"] = providers
        _save_json(SETTINGS_FILE, settings)
    return {"ok": True, "removed": pid}


@app.post("/api/ai/providers/{provider_id}/test", include_in_schema=False)
async def post_ai_provider_test(provider_id: str, payload: ProviderConfigPayload | None = None) -> dict:
    """Test connection for a specific provider and fetch all endpoint models without truncation."""
    pid = provider_id.strip()
    settings = _load_json(SETTINGS_FILE, {})
    providers = get_providers_config(settings)
    stored = providers.get(pid, {})

    target_base = (
        (payload.base_url.strip() if payload and payload.base_url else None)
        or stored.get("base_url")
        or "https://api.openai.com/v1"
    )

    if payload and payload.api_key and "****" not in payload.api_key:
        target_key = payload.api_key.strip()
    else:
        target_key = stored.get("api_key", "")

    client = OpenAICompatibleClient()
    ok, message, models = await client.test_connection(base_url=target_base, api_key=target_key)

    if ok and models and pid in providers:
        providers[pid]["discovered_models"] = models
        settings["providers"] = providers
        _save_json(SETTINGS_FILE, settings)

    return {
        "ok": ok,
        "message": message,
        "models": models,
        "provider_id": pid,
        "base_url": target_base,
    }


@app.post("/api/ai/providers/{provider_id}/models", include_in_schema=False)
async def post_ai_provider_model(provider_id: str, payload: AddCustomModelPayload) -> dict:
    """Add a custom user model to a specific provider."""
    pid = provider_id.strip()
    model_name = payload.model.strip()
    if not model_name:
        raise HTTPException(status_code=400, detail="Model name cannot be empty")

    settings = _load_json(SETTINGS_FILE, {})
    providers = get_providers_config(settings)
    if pid not in providers:
        providers[pid] = {
            "name": pid.title(),
            "base_url": "https://api.openai.com/v1",
            "api_key": "",
            "enabled": True,
            "custom_models": [],
            "discovered_models": [],
        }

    custom = list(providers[pid].get("custom_models") or [])
    if model_name not in custom:
        custom.append(model_name)
        providers[pid]["custom_models"] = custom
        settings["providers"] = providers
        _save_json(SETTINGS_FILE, settings)

    return {"ok": True, "provider_id": pid, "custom_models": custom, "added": model_name}


@app.delete("/api/ai/providers/{provider_id}/models/{model_name:path}", include_in_schema=False)
async def delete_ai_provider_model(provider_id: str, model_name: str) -> dict:
    """Remove a custom model from a specific provider."""
    pid = provider_id.strip()
    m_name = model_name.strip()
    settings = _load_json(SETTINGS_FILE, {})
    providers = get_providers_config(settings)
    custom = []
    if pid in providers:
        custom = list(providers[pid].get("custom_models") or [])
        if m_name in custom:
            custom = [m for m in custom if m != m_name]
            providers[pid]["custom_models"] = custom
            settings["providers"] = providers
            _save_json(SETTINGS_FILE, settings)

    return {"ok": True, "provider_id": pid, "custom_models": custom, "removed": m_name}


@app.post("/api/ai/assignments", include_in_schema=False)
async def post_ai_assignments(payload: AssignmentsPayload) -> dict:
    """Update role assignments (Director Mode and Chatbox Enhancer)."""
    settings = _load_json(SETTINGS_FILE, {})
    assignments = get_assignments_config(settings)

    if payload.director is not None:
        assignments["director"] = {
            "provider_id": payload.director.provider_id.strip(),
            "model": payload.director.model.strip(),
        }
        settings["director_model"] = payload.director.model.strip()
        settings["llm_model"] = payload.director.model.strip()

    if payload.enhancer is not None:
        assignments["enhancer"] = {
            "provider_id": payload.enhancer.provider_id.strip(),
            "model": payload.enhancer.model.strip(),
        }
        settings["enhancer_model"] = payload.enhancer.model.strip()

    settings["assignments"] = assignments
    _save_json(SETTINGS_FILE, settings)

    return {
        "ok": True,
        "assignments": assignments,
    }


# ── Character Studio & Active Session Lock API ──


@app.get("/api/characters", response_model=CharacterListResponse, include_in_schema=False)
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


@app.post("/api/characters", response_model=CharacterCard, include_in_schema=False)
async def create_character(payload: CreateCharacterRequest) -> CharacterCard:
    """Create and persist a new character card, or update if id already exists."""
    mgr = _get_character_manager()
    data = payload.model_dump()
    if data.get("id"):
        try:
            return mgr.update(data["id"], {k: v for k, v in data.items() if v is not None and k != "id"})
        except KeyError:
            pass
    else:
        data.pop("id", None)
    card = CharacterCard(**data)
    return mgr.create(card)


@app.put("/api/characters/{character_id}", response_model=CharacterCard, include_in_schema=False)
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


@app.delete("/api/characters/{character_id}", include_in_schema=False)
async def delete_character(character_id: str) -> dict[str, Any]:
    """Delete character by ID and remove active lock if this character was locked."""
    mgr = _get_character_manager()
    success = mgr.delete(character_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Character '{character_id}' not found")
    return {"ok": True, "id": character_id}


@app.post("/api/characters/{character_id}/lock", include_in_schema=False)
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


# ── 3-Pillar Character Consistency Handshake & Delta Engine API ──


class HandshakeRequest(BaseModel):
    conversation_id: str | None = Field(default=None, description="Target conversation ID, or 'new' for fresh thread")
    plot: str | None = Field(default=None, description="Optional plot/scene arc to anchor in roleplay mode")
    roleplay_info: str | None = Field(default=None, description="Optional roleplay instructions or context")
    screenplay_handshake: str | None = Field(default=None, description="Optional director screenplay briefing")


class BindConversationCharacterPayload(BaseModel):
    character_id: str | None = Field(default=None, description="Character ID to lock to this conversation, or null to detach")


@app.post("/api/characters/{character_id}/handshake", include_in_schema=False)
async def character_handshake_endpoint(
    character_id: str,
    req: HandshakeRequest | None = None,
) -> dict[str, Any]:
    """Execute Turn 0 Character Identity Contract Handshake.

    Simultaneously attaches the character's reference cards and submits the
    physical specification contract prompt to prime the conversation thread without generating an image.
    Supports embedding plot, roleplay info, and director screenplay briefing.
    """
    mgr = _get_character_manager()
    char = mgr.get(character_id)
    if not char:
        raise HTTPException(status_code=404, detail=f"Character '{character_id}' not found")

    target_cid = req.conversation_id if req else None
    if target_cid and target_cid.strip().lower() in ("new", "clean", "none", ""):
        target_cid = None

    await ws_broadcast({
        "type": "handshake_progress",
        "status": f"Establishing identity contract handshake for {char.name}...",
        "character_id": char.id,
        "character_name": char.name,
    })

    async with _lock:
        core = _get_core()
        if target_cid is None:
            if hasattr(core, "new_chat"):
                res_nc = core.new_chat()
                if asyncio.iscoroutine(res_nc):
                    await res_nc

        try:
            res = await core.establish_character_contract(
                char,
                images_dir=IMAGES_DIR,
                conversation_id=target_cid,
                plot=req.plot if req else None,
                roleplay_info=req.roleplay_info if req else None,
                screenplay_handshake=req.screenplay_handshake if req else None,
            )
            cid = res.get("conversation_id")
            if cid:
                _save_conversation_contract(cid, {
                    "character_id": char.id,
                    "character_name": char.name,
                    "primed": True,
                    "primed_at": time.time(),
                    "card_count": res.get("card_count", 0),
                })
            await ws_broadcast({
                "type": "handshake_completed",
                "character_id": char.id,
                "character_name": char.name,
                "conversation_id": cid,
            })
            return res
        except Exception as exc:
            log.error("Character handshake failed for %s: %s", character_id, exc, exc_info=True)
            return _error_response(exc)


@app.post("/api/characters/compile-delta", response_model=DeltaPromptResponse, include_in_schema=False)
async def compile_delta_endpoint(payload: DeltaPromptRequest) -> DeltaPromptResponse:
    """Compile structured delta fields into a clean prompt referencing locked character identity."""
    mgr = _get_character_manager()
    char = mgr.get(payload.character_id)
    if not char:
        raise HTTPException(status_code=404, detail=f"Character '{payload.character_id}' not found")

    prompt = char.compile_delta_prompt(
        scene=payload.scene,
        outfit=payload.outfit,
        pose=payload.pose,
        expression=payload.expression,
        camera=payload.camera,
        lighting=payload.lighting,
        background=payload.background,
        style_override=payload.style_override,
    )
    return DeltaPromptResponse(
        character_id=char.id,
        character_name=char.name,
        compiled_prompt=prompt,
    )


@app.get("/api/conversations/contracts", include_in_schema=False)
async def get_all_conversation_contracts() -> dict[str, Any]:
    """List all conversation threads with primed character contracts."""
    contracts = _load_conversation_contracts()
    return {"ok": True, "contracts": contracts}


@app.get("/api/conversations/{conversation_id}/contract", include_in_schema=False)
async def get_conversation_contract_endpoint(conversation_id: str) -> dict[str, Any]:
    """Retrieve character contract status for a conversation thread."""
    clean_id = conversation_id.strip()
    contracts = _load_conversation_contracts()
    info = contracts.get(clean_id)
    if info:
        return {"ok": True, "conversation_id": clean_id, **info}
    return {
        "ok": True,
        "conversation_id": clean_id,
        "primed": False,
        "character_id": None,
        "character_name": None,
    }


@app.post("/api/conversations/{conversation_id}/character", include_in_schema=False)
async def bind_conversation_character_endpoint(
    conversation_id: str,
    payload: BindConversationCharacterPayload,
) -> dict[str, Any]:
    """Explicitly associate or lock a conversation to a specific character."""
    clean_id = conversation_id.strip()
    mgr = _get_character_manager()
    contracts = _load_conversation_contracts()

    if payload.character_id is None:
        contracts.pop(clean_id, None)
        _save_conversation_contracts(contracts)
        return {"ok": True, "conversation_id": clean_id, "character_id": None, "character_name": None, "primed": False}

    char = mgr.get(payload.character_id)
    if not char:
        raise HTTPException(status_code=404, detail=f"Character '{payload.character_id}' not found")

    existing = contracts.get(clean_id, {})
    contracts[clean_id] = {
        **existing,
        "character_id": char.id,
        "character_name": char.name,
        "primed": existing.get("primed", False),
    }
    _save_conversation_contracts(contracts)
    return {"ok": True, "conversation_id": clean_id, **contracts[clean_id]}


# ── Reference Card Generator API ──


class FaceCardDataPayload(BaseModel):
    data: dict[str, Any] = Field(default_factory=dict)


class FaceCardRandomizePayload(BaseModel):
    archetype: str | None = None


class FaceCardGeneratePayload(BaseModel):
    data: dict[str, Any] = Field(default_factory=dict)
    conversation_id: str | None = None
    prompt: str | None = None


@app.get("/api/cards/face/dictionary", include_in_schema=False)
async def get_face_card_dictionary() -> dict[str, Any]:
    """Return dynamic data dictionary schema and harmonized archetype presets."""
    return {
        "ok": True,
        "dictionary": FACE_DICTIONARY,
        "archetypes": ARCHETYPE_PRESETS,
    }


@app.post("/api/cards/face/compile-prompt", include_in_schema=False)
async def compile_face_card_prompt_endpoint(payload: FaceCardDataPayload) -> dict[str, Any]:
    """Compile dictionary selections into standard 16:9 prompt template and Visual DNA."""
    prompt = compile_face_card_prompt(payload.data)
    visual_dna = compile_visual_dna(payload.data)
    return {
        "ok": True,
        "prompt": prompt,
        "visual_dna": visual_dna,
    }


@app.post("/api/cards/face/randomize", include_in_schema=False)
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


@app.post("/api/cards/face/generate", include_in_schema=False)
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


@app.get("/api/cards/body/dictionary", include_in_schema=False)
async def get_body_card_dictionary() -> dict[str, Any]:
    """Return dynamic data dictionary schema and harmonized archetype presets for body cards."""
    return {
        "ok": True,
        "dictionary": BODY_DICTIONARY,
        "archetypes": BODY_ARCHETYPES,
    }


@app.post("/api/cards/body/compile-prompt", include_in_schema=False)
async def compile_body_card_prompt_endpoint(payload: BodyCardDataPayload) -> dict[str, Any]:
    """Compile dictionary selections into standard 4:3 prompt template and Visual DNA."""
    prompt = compile_body_card_prompt(payload.data)
    visual_dna = compile_body_visual_dna(payload.data)
    return {
        "ok": True,
        "prompt": prompt,
        "visual_dna": visual_dna,
    }


@app.post("/api/cards/body/randomize", include_in_schema=False)
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


@app.post("/api/cards/body/generate", include_in_schema=False)
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


@app.post("/api/cards/expression/generate", include_in_schema=False)
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


_director_state: dict[str, Any] = {
    "is_running": False,
    "cancel_requested": False,
    "current_shot": 0,
    "total_shots": 0,
    "status": "Idle",
    "last_error": None,
    "conversation_id": None,
}


async def _execute_director_sequence(
    shots: list[StoryboardShot],
    character_id: str | None = None,
    conversation_id: str | None = None,
    screenplay_handshake: str | None = None,
    plot: str | None = None,
    roleplay_info: str | None = None,
):
    global _director_state
    _director_state["is_running"] = True
    _director_state["cancel_requested"] = False
    _director_state["total_shots"] = len(shots)
    _director_state["current_shot"] = 0
    _director_state["status"] = "Initializing sequence..."
    _director_state["last_error"] = None
    _director_state["conversation_id"] = conversation_id

    mgr = _get_character_manager()
    char = None
    if character_id and character_id != "freeform":
        char = mgr.get(character_id)
    elif character_id != "freeform":
        char = mgr.get_active_character()
    conv_id = conversation_id

    # ── 2-Stage Handshake Execution ──────────────────────────────────────────────
    # Turn 0: Character Lock Identity Contract (Physical specification & 3 reference cards)
    # Turn 1: Roleplay & Fictional World Contract (Plot, storyline, scenario, medium & safety sandbox)
    contracts = _load_conversation_contracts()

    # Turn 0: Establish Character Identity
    if char:
        is_primed = contracts.get(conv_id, {}).get("primed", False) if conv_id else False
        if not is_primed:
            _director_state["status"] = f"Turn 0: Character Identity Handshake for {char.name}..."
            await ws_broadcast({
                "type": "director_sequence_progress",
                "shot_index": 0,
                "total_shots": len(shots),
                "status": _director_state["status"],
                "conversation_id": conv_id,
            })
            try:
                handshake_res = await character_handshake_endpoint(
                    char.id,
                    HandshakeRequest(
                        conversation_id=conv_id,
                        plot=None,  # Plot is cleanly handled in Turn 1 Roleplay Handshake
                        roleplay_info=None,
                        screenplay_handshake=None,
                    )
                )
                if handshake_res and isinstance(handshake_res, dict) and handshake_res.get("conversation_id"):
                    conv_id = handshake_res.get("conversation_id")
                    _director_state["conversation_id"] = conv_id
                    contracts = _load_conversation_contracts()
            except Exception as e:
                log.warning(f"Turn 0 character handshake warning during director sequence: {e}")

    elif screenplay_handshake:
        is_director_primed = contracts.get(conv_id, {}).get("director_primed", False) if conv_id else False
        if not is_director_primed:
            _director_state["status"] = "Turn 0: Protagonist Screenplay Handshake..."
            await ws_broadcast({
                "type": "director_sequence_progress",
                "shot_index": 0,
                "total_shots": len(shots),
                "status": _director_state["status"],
                "conversation_id": conv_id,
            })
            try:
                async with _lock:
                    core = _get_core()
                    if conv_id is None:
                        if hasattr(core, "new_chat"):
                            res_nc = core.new_chat()
                            if asyncio.iscoroutine(res_nc):
                                await res_nc
                    else:
                        await _align_account_for_conversation(conv_id)

                    turn0_res = await core.ask(
                        screenplay_handshake,
                        conversation_id=conv_id,
                    )
                    if isinstance(turn0_res, dict) and turn0_res.get("conversation_id"):
                        conv_id = turn0_res["conversation_id"]
                        _director_state["conversation_id"] = conv_id
                        _save_conversation_contract(conv_id, {
                            "director_primed": True,
                            "mode": "freeform_director",
                            "primed_at": time.time(),
                            "screenplay_preview": screenplay_handshake[:160],
                        })
                        contracts = _load_conversation_contracts()
            except Exception as e:
                log.warning(f"Turn 0 director screenplay handshake warning: {e}")

    # Turn 1: Roleplay & Fictional World Handshake (Explaining fictional world, roleplay, plot, scenario)
    if not _director_state["cancel_requested"]:
        is_roleplay_primed = contracts.get(conv_id, {}).get("roleplay_primed", False) if conv_id else False
        effective_plot = plot or _director_state.get("intent") or "Artistic narrative sequence"
        effective_roleplay = roleplay_info or (char.roleplay_instructions if char else None) or "Creative storytelling roleplay"

        if not is_roleplay_primed and conv_id:
            protagonist_label = char.name if char else "the established protagonist"
            roleplay_contract = (
                f"[DIRECTOR'S PRODUCTION CONTRACT: CREATIVE FICTIONAL ROLEPLAY & SCENARIO]\n"
                f"This session is a creative, fictional storytelling roleplay set in an imaginative fictional world.\n"
                f"- Context: Fictional creative writing & visual scene illustration.\n"
                f"- Protagonist: {protagonist_label} (fictional adult character, identity locked from Turn 0).\n"
                f"- Plot Storyline & Narrative Scenario: {effective_plot}\n"
                f"- Roleplay Directives: {effective_roleplay}\n"
                f"- Visual Cinematography & Medium: Natural real-world photography, authentic perspective, natural unretouched skin micro-texture with visible microscopic pores, zero synthetic airbrushing or plastic sheen.\n"
                f"- Safety & Content Sandbox: All scenes depicted are benign artistic storytelling adhering to community standards in a safe, fictional roleplay context.\n\n"
                f"ChatGPT, acknowledge this fictional roleplay scenario, setting, and storytelling context. "
                f"Confirm you are ready to proceed with Shot 1 of the storyboard."
            )

            _director_state["status"] = "Turn 1: Roleplay & Fictional Scenario Handshake..."
            await ws_broadcast({
                "type": "director_sequence_progress",
                "shot_index": 0,
                "total_shots": len(shots),
                "status": _director_state["status"],
                "conversation_id": conv_id,
            })

            try:
                async with _lock:
                    core = _get_core()
                    await _align_account_for_conversation(conv_id)
                    turn1_res = await core.ask(
                        roleplay_contract,
                        conversation_id=conv_id,
                    )
                    if isinstance(turn1_res, dict) and turn1_res.get("conversation_id"):
                        conv_id = turn1_res["conversation_id"]
                        _director_state["conversation_id"] = conv_id
                        _save_conversation_contract(conv_id, {
                            "roleplay_primed": True,
                            "roleplay_primed_at": time.time(),
                            "plot": effective_plot,
                        })
            except Exception as e:
                log.warning(f"Turn 1 roleplay handshake warning: {e}")

    try:
        for i, shot in enumerate(shots):
            if _director_state["cancel_requested"]:
                _director_state["status"] = "Cancelled by user"
                await ws_broadcast({
                    "type": "director_sequence_progress",
                    "shot_index": i,
                    "total_shots": len(shots),
                    "status": "Cancelled",
                })
                break

            _director_state["current_shot"] = i + 1
            _director_state["status"] = f"Generating shot {i + 1} of {len(shots)}..."
            await ws_broadcast({
                "type": "director_sequence_progress",
                "shot_index": i + 1,
                "total_shots": len(shots),
                "status": _director_state["status"],
                "shot": shot.model_dump(),
                "conversation_id": conv_id,
            })

            req = ImageRequest(
                prompt=shot.prompt,
                conversation_id=conv_id,
                metadata={
                    "director_shot": shot.model_dump(),
                    "character_id": char.id if char else None,
                },
            )

            try:
                res = await image(req)
                if isinstance(res, JSONResponse):
                    err_msg = "Generation failed"
                    try:
                        import json
                        body = json.loads(res.body.decode()) if hasattr(res, "body") else {}
                        err_msg = body.get("detail") or body.get("error") or str(body)
                    except Exception:
                        pass
                    raise RuntimeError(f"Engine rejected shot {i + 1}: {err_msg}")

                if isinstance(res, dict) and res.get("conversation_id"):
                    conv_id = res["conversation_id"]
                    _director_state["conversation_id"] = conv_id
            except Exception as e:
                log.error(f"Director sequence error on shot {i}: {e}", exc_info=True)
                _director_state["last_error"] = str(e)
                _director_state["status"] = f"Error: {e}"
                await ws_broadcast({
                    "type": "director_sequence_error",
                    "shot_index": i + 1,
                    "error": str(e),
                })
                break

            if i < len(shots) - 1:
                # Pace shots and check cancel request periodically
                for _ in range(8):
                    if _director_state["cancel_requested"]:
                        break
                    await asyncio.sleep(1)

        if not _director_state["cancel_requested"] and not _director_state["last_error"]:
            _director_state["status"] = "Complete"
            _director_state["current_shot"] = len(shots)
            await ws_broadcast({
                "type": "director_sequence_progress",
                "status": "Complete",
                "shot_index": len(shots),
                "total_shots": len(shots),
                "conversation_id": conv_id,
            })
    finally:
        _director_state["is_running"] = False
        if conv_id:
            try:
                core = _get_core()
                core._current_conversation_id = conv_id
            except Exception:
                pass


@app.get("/api/director/status", include_in_schema=False)
async def api_director_status():
    """Live status of automated multi-shot director sequence."""
    return _director_state


@app.post("/api/director/cancel", include_in_schema=False)
async def api_director_cancel():
    """Cancel currently running automated director sequence."""
    if _director_state["is_running"]:
        _director_state["cancel_requested"] = True
        return {"ok": True, "message": "Cancellation requested"}
    return {"ok": True, "message": "No sequence currently running"}


@app.post("/api/director/execute", include_in_schema=False)
async def api_director_execute(req: DirectorExecuteRequest, background_tasks: BackgroundTasks):
    if _director_state["is_running"]:
        raise HTTPException(status_code=409, detail="A director sequence is already running")
    background_tasks.add_task(
        _execute_director_sequence,
        req.shots,
        character_id=req.character_id,
        conversation_id=req.conversation_id,
        screenplay_handshake=req.screenplay_handshake,
        plot=req.plot,
        roleplay_info=req.roleplay_info,
    )
    return {"ok": True, "message": "Sequence execution started"}


@app.post("/api/director/plan", response_model=StoryboardPlan, include_in_schema=False)
async def api_director_plan(req: DirectorPlanRequest):
    mgr = _get_character_manager()
    char = None
    if req.character_id and req.character_id != "freeform":
        char = mgr.get(req.character_id)
    elif req.character_id != "freeform":
        char = mgr.get_active_character()

    settings = _load_json(SETTINGS_FILE, {})
    base_url, api_key, model, provider_id = resolve_llm_execution(
        settings,
        role="director",
        requested_provider_id=req.provider_id,
        requested_model=req.model,
    )

    llm = OpenAICompatibleClient()
    engine = DirectorEngine(llm, base_url=base_url, api_key=api_key, model=model)
    try:
        plan = await engine.plan_storyboard(
            intent=req.intent,
            character=char,
            shot_count=req.shot_count,
            creative_guidance=req.creative_guidance,
            style_override=req.style_override,
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


@app.get("/api/storage/status", include_in_schema=False)
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


@app.post("/api/storage/test", include_in_schema=False)
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


@app.get("/api/storage/topics", include_in_schema=False)
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


@app.post("/api/storage/thumbnails/regenerate", include_in_schema=False)
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


@app.post("/api/storage/sync", include_in_schema=False)
async def api_storage_sync() -> dict:
    """Trigger background migration/sync of existing images to Telegram."""
    global _sync_progress
    if _sync_progress["running"]:
        return {"ok": False, "message": "Sync is already in progress", "progress": _sync_progress}
    asyncio.create_task(_run_storage_sync())
    return {"ok": True, "message": "Storage sync started in background"}


@app.get("/api/storage/sync/status", include_in_schema=False)
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


@app.post("/api/storage/backup", include_in_schema=False)
async def api_storage_backup() -> dict[str, Any]:
    """Trigger manual vault manifest backup & upload to Telegram."""
    return await perform_vault_manifest_backup(auto_pin=True)


@app.post("/api/storage/restore", include_in_schema=False)
async def api_storage_restore() -> dict[str, Any]:
    """Trigger manual restore of gallery index from pinned Telegram manifest."""
    return await perform_vault_manifest_restore()


@app.get("/api/storage/backups", include_in_schema=False)
async def api_storage_backups() -> dict[str, Any]:
    """Query backup manifest history and latest status."""
    history = get_backup_history(VAULT_BACKUPS_FILE)
    return {
        "total_backups": len(history),
        "latest": history[-1] if history else None,
        "history": history[-7:],
    }


@app.get("/api/state", include_in_schema=False)
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


@app.post("/api/state", include_in_schema=False)
async def save_client_state(state: dict = Body(...)) -> dict:
    """Persist UI client state so page reloads seamlessly restore full session context."""
    current = _load_json(STATE_FILE, {})
    current.update(state)
    current["lastUpdated"] = time.time()
    _save_json(STATE_FILE, current)
    return current


# ── Full-Text & Vector Search API ──


@app.get("/api/search", include_in_schema=False)
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


@app.get("/api/telemetry", include_in_schema=False)
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


@app.get("/api/prompt-library", include_in_schema=False)
async def get_prompt_library():
    """Retrieve standard categories and user custom preset chips."""
    return {
        "standard": _prompt_library.get_standard_categories(),
        "custom": _prompt_library.get_custom_chips(),
    }


@app.post("/api/prompt-library/custom", include_in_schema=False)
async def add_custom_chip(req: CustomChipRequest):
    """Add a new custom preset chip."""
    chip_id = _prompt_library.add_custom_chip(req.text)
    return {"id": chip_id, "text": req.text}


@app.delete("/api/prompt-library/custom/{chip_id}", include_in_schema=False)
async def delete_custom_chip(chip_id: str):
    """Delete a custom preset chip by ID."""
    _prompt_library.delete_custom_chip(chip_id)
    return {"status": "ok"}


@app.get("/api/prompt-gallery", include_in_schema=False)
async def get_prompt_gallery(
    category: str | None = None,
    style: str | None = None,
    scene: str | None = None,
    source: str | None = None,
    search: str | None = None,
    lang: str | None = None,
    page: int = 1,
    per_page: int = 24,
):
    """Browse curated image prompt gallery with multi-tag filtering, search, and pagination."""
    return _prompt_library.get_curated_prompts(
        category=category,
        style=style,
        scene=scene,
        source=source,
        search=search,
        lang=lang,
        page=page,
        per_page=per_page,
    )


@app.get("/api/prompt-gallery/taxonomy", include_in_schema=False)
async def get_prompt_gallery_taxonomy():
    """Retrieve full style taxonomy including categories, styles, scenes, and templates."""
    return _prompt_library.get_taxonomy()


@app.get("/api/prompt-gallery/slash-commands", include_in_schema=False)
async def get_prompt_gallery_slash_commands():
    """Retrieve curated slash command prompt techniques."""
    return _prompt_library.get_slash_commands()


@app.get("/api/prompt-gallery/thumbnails/{prompt_id}", include_in_schema=False)
async def get_prompt_gallery_thumbnail(prompt_id: int):
    """Retrieve or dynamically cache a compressed local WebP thumbnail for a prompt."""
    result = _prompt_library.get_thumbnail(prompt_id)
    if not result:
        raise HTTPException(status_code=404, detail="Thumbnail not found")
    data, media_type = result
    return Response(
        content=data,
        media_type=media_type,
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )


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
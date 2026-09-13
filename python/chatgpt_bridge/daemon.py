"""FastAPI daemon exposing ChatGPT bridge as a universal REST service."""

from __future__ import annotations

import asyncio
import json
import os
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
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

# Port defaults to 8465, configurable via PORT or CHATGPT_BRIDGE_PORT
PORT = int(os.environ.get("PORT") or os.environ.get("CHATGPT_BRIDGE_PORT") or "8465")
HOST = os.environ.get("HOST", "0.0.0.0")

app = FastAPI(
    title="ChatGPT Bridge API",
    description="Universal REST API for ChatGPT text conversations and DALL-E image generation with automatic retry.",
    version="1.0.0",
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


class AskRequest(BaseModel):
    prompt: str = Field(..., description="Prompt or message to send to ChatGPT")
    model: str | None = Field(default=None, description="Optional model specifier")
    conversation_id: str | None = Field(default=None, description="Optional conversation ID for continuity")


class ImageRequest(BaseModel):
    prompt: str = Field(..., description="Image prompt description")
    timeout_s: int = Field(default=180, ge=1, description="Timeout in seconds for generation")
    max_tries: int | None = Field(default=None, description="Max retries on refusal (defaults to server config, e.g. 4)")
    conversation_id: str | None = Field(default=None, description="Optional conversation ID for continuity")


def _get_core() -> ChatGPT:
    global _core
    if _core is None:
        headless = os.environ.get("CHATGPT_BRIDGE_HEADLESS", "0") == "1"
        _core = ChatGPT(headless=headless)
    return _core


def _error_response(exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=502,
        content={"error": {"type": type(exc).__name__, "message": str(exc)}},
    )


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
        alive = await core.session.is_alive()
    except Exception:
        pass
    return {
        "ok": True,
        "authenticated": alive,
        "browser_started": core._started,
        "current_conversation_id": core._current_conversation_id,
        "chats_tracked": len(core.pool._ids),
        "max_retries": core.max_retries,
        "idle_timeout_s": core.idle_timeout_s,
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
    async with _lock:
        try:
            kwargs = {}
            if req.max_tries is not None:
                kwargs["max_retries"] = req.max_tries
            if req.conversation_id is not None:
                kwargs["conversation_id"] = req.conversation_id
            result = await _get_core().generate_image(
                req.prompt, timeout_s=req.timeout_s, **kwargs
            )
            # Add relative web image_url for easy frontend consumption
            if "path" in result:
                p = Path(result["path"])
                result["image_url"] = f"/images/{p.name}"
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
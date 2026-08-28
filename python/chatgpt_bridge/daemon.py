"""FastAPI daemon exposing the core as a localhost HTTP service."""

from __future__ import annotations

import asyncio
import json
import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from .core import ChatGPT
from .errors import AuthError, BridgeTimeoutError, DaemonUnreachableError, ShapeChangedError

STATE_DIR = Path(os.environ.get("CHATGPT_BRIDGE_STATE", "~/.chatgpt-bridge")).expanduser()
DAEMON_JSON = STATE_DIR / "daemon.json"
PORT = 8765

app = FastAPI(title="chatgpt-bridge daemon")

# Single shared core instance; requests serialized via a lock (single tab).
_core: ChatGPT | None = None
_lock = asyncio.Lock()


class AskRequest(BaseModel):
    prompt: str
    model: str | None = None
    conversation_id: str | None = None


class ImageRequest(BaseModel):
    prompt: str
    timeout_s: int = Field(default=180, ge=1)


def _get_core() -> ChatGPT:
    global _core
    if _core is None:
        _core = ChatGPT(headless=True)
    return _core


def _error_response(exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=502,
        content={"error": {"type": type(exc).__name__, "message": str(exc)}},
    )


@app.get("/health")
async def health() -> dict:
    return {"ok": True}


@app.post("/ask")
async def ask(req: AskRequest) -> dict:
    async with _lock:
        try:
            return await _get_core().ask(
                req.prompt, model=req.model, conversation_id=req.conversation_id
            )
        except (AuthError, ShapeChangedError, BridgeTimeoutError, DaemonUnreachableError) as exc:
            return _error_response(exc)


@app.post("/image")
async def image(req: ImageRequest) -> dict:
    async with _lock:
        try:
            return await _get_core().generate_image(req.prompt, timeout_s=req.timeout_s)
        except (AuthError, ShapeChangedError, BridgeTimeoutError, DaemonUnreachableError) as exc:
            return _error_response(exc)


def write_daemon_json() -> None:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    (STATE_DIR / "daemon.json").write_text(
        json.dumps({"pid": os.getpid(), "port": PORT}), encoding="utf-8"
    )


def main() -> None:
    import uvicorn

    write_daemon_json()
    uvicorn.run(app, host="127.0.0.1", port=PORT)


if __name__ == "__main__":
    main()
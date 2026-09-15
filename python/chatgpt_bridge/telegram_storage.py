"""Telegram Cloud Storage engine for backing up generated images to a private channel/chat."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import httpx

log = logging.getLogger("chatgpt_bridge.telegram_storage")

TELEGRAM_API_BASE = "https://api.telegram.org"


class TelegramStorageError(Exception):
    """Base error for Telegram storage operations."""
    pass


class TelegramAuthError(TelegramStorageError):
    """Invalid bot token or unauthorized access."""
    pass


class TelegramChatError(TelegramStorageError):
    """Invalid channel/chat ID or bot lacks post permissions."""
    pass


def get_chat_id_candidates(chat_id: str | int) -> list[str]:
    """Generate potential Telegram chat_id candidates.
    
    Supports naked positive digits, channels with -100 prefix, and basic groups with - prefix.
    """
    raw = str(chat_id).strip()
    if not raw:
        return []
    if raw.startswith("@") or raw.startswith("-100"):
        return [raw]
    if raw.startswith("-"):
        num = raw[1:]
        return [raw, f"-100{num}"]
    # Bare digits entered by user (e.g. 4440931493)
    return [f"-100{raw}", f"-{raw}", raw]


async def verify_telegram_connection(token: str, chat_id: str | int) -> dict[str, Any]:
    """Test bot authentication and chat post permissions.

    1. Checks getMe to verify bot token.
    2. Sends a sendChatAction (upload_document) to verify bot can post to chat_id.
    """
    token = token.strip()
    chat_id = str(chat_id).strip()

    if not token:
        raise TelegramAuthError("Telegram bot token is empty")
    if not chat_id:
        raise TelegramChatError("Telegram channel/chat ID is empty")

    async with httpx.AsyncClient(timeout=15.0) as client:
        # 1. Verify Bot Token
        me_resp = await client.get(f"{TELEGRAM_API_BASE}/bot{token}/getMe")
        if me_resp.status_code in (401, 404):
            raise TelegramAuthError("Invalid Telegram Bot Token (401 Unauthorized)")
        if me_resp.status_code != 200:
            raise TelegramStorageError(f"Telegram getMe failed with HTTP {me_resp.status_code}")
        
        me_data = me_resp.json()
        if not me_data.get("ok"):
            raise TelegramAuthError(me_data.get("description", "Failed to authenticate bot"))
        
        bot_info = me_data.get("result", {})
        bot_username = bot_info.get("username", "UnknownBot")

        # 2. Verify Chat Permissions via sendChatAction (does not leave clutter)
        candidates = get_chat_id_candidates(chat_id)
        last_desc = "Bot cannot post to this channel/chat"
        for cand in candidates:
            try:
                action_resp = await client.post(
                    f"{TELEGRAM_API_BASE}/bot{token}/sendChatAction",
                    json={"chat_id": cand, "action": "upload_document"},
                )
                action_data = action_resp.json()
                if action_resp.status_code == 200 and action_data.get("ok"):
                    return {
                        "ok": True,
                        "bot_username": bot_username,
                        "chat_id": cand,
                        "message": f"Successfully connected to @{bot_username} with access to chat {cand}",
                    }
                last_desc = action_data.get("description", last_desc)
            except Exception as e:
                last_desc = str(e)

        raise TelegramChatError(
            f"Failed to access chat '{chat_id}': {last_desc}. "
            f"Ensure @{bot_username} is added as an Administrator to the channel/group with post permissions."
        )


DEFAULT_FORUM_TOPICS = {
    "data": 8,
    "backup": 5,
    "general": 1,
}


async def discover_forum_topics(token: str, chat_id: str | int) -> dict[str, Any]:
    """Discover forum topic thread IDs by querying Telegram updates or fall back to defaults."""
    token = token.strip()
    chat_id = str(chat_id).strip()
    discovered: dict[str, int] = dict(DEFAULT_FORUM_TOPICS)

    if not token:
        return {"ok": False, "topics": discovered, "error": "Token is empty"}

    url = f"{TELEGRAM_API_BASE}/bot{token}/getUpdates"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                data = resp.json()
                for item in data.get("result", []):
                    msg = item.get("message", {})
                    topic = msg.get("forum_topic_created")
                    thread_id = msg.get("message_thread_id")
                    if topic and thread_id:
                        tname = str(topic.get("name", "")).lower()
                        if "data" in tname:
                            discovered["data"] = thread_id
                        elif "backup" in tname or "restore" in tname:
                            discovered["backup"] = thread_id
                        elif "general" in tname:
                            discovered["general"] = thread_id
    except Exception as exc:
        log.warning("Failed to query getUpdates for topics: %s", exc)

    return {"ok": True, "topics": discovered}


async def upload_document_to_telegram(
    token: str,
    chat_id: str | int,
    file_path: Path | bytes,
    filename: str | None = None,
    caption: str | None = None,
    message_thread_id: int | None = None,
) -> dict[str, Any]:
    """Upload an uncompressed image as a document to Telegram.

    Preserves 100% original PNG quality bit-for-bit.
    Supports message_thread_id for targeting specific forum topics (e.g. Data topic).
    Returns:
        {
            "file_id": str,
            "file_unique_id": str,
            "file_size": int,
            "message_id": int,
            "chat_id": str | int,
        }
    """
    token = token.strip()
    chat_id = str(chat_id).strip()

    if isinstance(file_path, Path):
        filename = filename or file_path.name
        content = file_path.read_bytes()
    else:
        content = file_path
        filename = filename or "image.png"

    candidates = get_chat_id_candidates(chat_id)
    last_desc = "Unknown error"
    url = f"{TELEGRAM_API_BASE}/bot{token}/sendDocument"

    async with httpx.AsyncClient(timeout=60.0) as client:
        for cand in candidates:
            data: dict[str, Any] = {"chat_id": cand}
            if message_thread_id is not None:
                data["message_thread_id"] = int(message_thread_id)
            if caption:
                # Telegram caption max length is 1024 chars
                data["caption"] = caption[:1024]

            files = {"document": (filename, content, "image/png")}
            resp = await client.post(url, data=data, files=files)
            res_data = resp.json()

            if not res_data.get("ok") and "message thread not found" in str(res_data.get("description", "")).lower():
                # In Telegram supergroups, the General topic is often the root chat thread without a thread ID.
                # Auto-fallback to posting without message_thread_id.
                data_fallback = dict(data)
                data_fallback.pop("message_thread_id", None)
                fb_files = {"document": (filename, content, "image/png")}
                resp = await client.post(url, data=data_fallback, files=fb_files)
                res_data = resp.json()

            if resp.status_code == 429 or res_data.get("error_code") == 429:
                retry_after = res_data.get("parameters", {}).get("retry_after", 3)
                log.warning("Telegram rate limit (429) reached on sendDocument, sleeping %d seconds...", retry_after)
                await asyncio.sleep(retry_after + 1)
                resp = await client.post(url, data=data, files={"document": (filename, content, "image/png")})
                res_data = resp.json()

            if resp.status_code == 200 and res_data.get("ok"):
                result = res_data.get("result", {})
                doc = result.get("document", {})
                return {
                    "file_id": doc.get("file_id"),
                    "file_unique_id": doc.get("file_unique_id"),
                    "file_size": doc.get("file_size", len(content)),
                    "message_id": result.get("message_id"),
                    "chat_id": cand,
                }
            last_desc = res_data.get("description", f"HTTP {resp.status_code}")

    raise TelegramStorageError(f"Telegram sendDocument failed: {last_desc}")


async def send_photo_to_telegram(
    token: str,
    chat_id: str | int,
    file_path: Path | bytes,
    caption: str | None = None,
    message_thread_id: int | None = None,
) -> dict[str, Any]:
    """Send an image as a photo (highest quality preview in Telegram viewer) to Telegram.

    Supports message_thread_id for targeting specific forum topics (e.g. General topic).
    Returns:
        {
            "file_id": str,
            "file_unique_id": str,
            "width": int,
            "height": int,
            "message_id": int,
            "chat_id": str | int,
        }
    """
    token = token.strip()
    chat_id = str(chat_id).strip()

    if isinstance(file_path, Path):
        content = file_path.read_bytes()
        filename = file_path.name
    else:
        content = file_path
        filename = "photo.png"

    candidates = get_chat_id_candidates(chat_id)
    last_desc = "Unknown error"
    url = f"{TELEGRAM_API_BASE}/bot{token}/sendPhoto"

    async with httpx.AsyncClient(timeout=60.0) as client:
        for cand in candidates:
            data: dict[str, Any] = {"chat_id": cand}
            if message_thread_id is not None:
                data["message_thread_id"] = int(message_thread_id)
            if caption:
                data["caption"] = caption[:1024]

            files = {"photo": (filename, content, "image/png")}
            resp = await client.post(url, data=data, files=files)
            res_data = resp.json()

            if not res_data.get("ok") and "message thread not found" in str(res_data.get("description", "")).lower():
                # In Telegram supergroups, the General topic is often the root chat thread without a thread ID.
                # Auto-fallback to posting without message_thread_id.
                data_fallback = dict(data)
                data_fallback.pop("message_thread_id", None)
                fb_files = {"photo": (filename, content, "image/png")}
                resp = await client.post(url, data=data_fallback, files=fb_files)
                res_data = resp.json()

            if resp.status_code == 429 or res_data.get("error_code") == 429:
                retry_after = res_data.get("parameters", {}).get("retry_after", 3)
                log.warning("Telegram rate limit (429) reached on sendPhoto, sleeping %d seconds...", retry_after)
                await asyncio.sleep(retry_after + 1)
                resp = await client.post(url, data=data, files={"photo": (filename, content, "image/png")})
                res_data = resp.json()

            if resp.status_code == 200 and res_data.get("ok"):
                result = res_data.get("result", {})
                photos = result.get("photo", [])
                # The highest resolution photo is the last element
                best_photo = photos[-1] if photos else {}
                return {
                    "file_id": best_photo.get("file_id"),
                    "file_unique_id": best_photo.get("file_unique_id"),
                    "width": best_photo.get("width", 0),
                    "height": best_photo.get("height", 0),
                    "message_id": result.get("message_id"),
                    "chat_id": cand,
                }
            last_desc = res_data.get("description", f"HTTP {resp.status_code}")

    raise TelegramStorageError(f"Telegram sendPhoto failed: {last_desc}")



async def get_telegram_file_path(token: str, file_id: str) -> str:
    """Query Telegram getFile to obtain the relative download file_path."""
    token = token.strip()
    file_id = file_id.strip()

    url = f"{TELEGRAM_API_BASE}/bot{token}/getFile"
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(url, params={"file_id": file_id})
        res_data = resp.json()

        if resp.status_code != 200 or not res_data.get("ok"):
            desc = res_data.get("description", f"HTTP {resp.status_code}")
            raise TelegramStorageError(f"Telegram getFile failed: {desc}")

        result = res_data.get("result", {})
        file_path = result.get("file_path")
        if not file_path:
            raise TelegramStorageError("Telegram getFile returned no file_path")
        return file_path


async def download_file_from_telegram(token: str, file_id: str) -> bytes:
    """Download full raw image bytes from Telegram for a given file_id."""
    token = token.strip()
    file_path = await get_telegram_file_path(token, file_id)

    download_url = f"{TELEGRAM_API_BASE}/file/bot{token}/{file_path}"
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.get(download_url)
        if resp.status_code != 200:
            raise TelegramStorageError(f"Failed to download file from Telegram: HTTP {resp.status_code}")
        return resp.content


async def pin_chat_message(token: str, chat_id: str | int, message_id: int, disable_notification: bool = True) -> bool:
    """Pin a message in the chat/supergroup."""
    token = token.strip()
    chat_id = str(chat_id).strip()
    url = f"{TELEGRAM_API_BASE}/bot{token}/pinChatMessage"
    payload = {"chat_id": chat_id, "message_id": message_id, "disable_notification": disable_notification}
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(url, json=payload)
        data = resp.json()
        return bool(resp.status_code == 200 and data.get("ok"))


async def unpin_chat_message(token: str, chat_id: str | int, message_id: int | None = None) -> bool:
    """Unpin a message in the chat/supergroup."""
    token = token.strip()
    chat_id = str(chat_id).strip()
    url = f"{TELEGRAM_API_BASE}/bot{token}/unpinChatMessage"
    payload: dict[str, Any] = {"chat_id": chat_id}
    if message_id is not None:
        payload["message_id"] = message_id
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(url, json=payload)
        data = resp.json()
        return bool(resp.status_code == 200 and data.get("ok"))


async def delete_chat_message(token: str, chat_id: str | int, message_id: int) -> bool:
    """Delete a message from the supergroup/chat."""
    token = token.strip()
    chat_id = str(chat_id).strip()
    url = f"{TELEGRAM_API_BASE}/bot{token}/deleteMessage"
    payload = {"chat_id": chat_id, "message_id": message_id}
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(url, json=payload)
        data = resp.json()
        return bool(resp.status_code == 200 and data.get("ok"))


async def get_pinned_manifest_doc(token: str, chat_id: str | int) -> dict[str, Any] | None:
    """Retrieve the pinned vault manifest document info from getChat, if available."""
    token = token.strip()
    chat_id = str(chat_id).strip()
    url = f"{TELEGRAM_API_BASE}/bot{token}/getChat"
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(url, params={"chat_id": chat_id})
        if resp.status_code != 200:
            return None
        data = resp.json()
        if not data.get("ok"):
            return None
        chat = data.get("result", {})
        pinned = chat.get("pinned_message", {})
        doc = pinned.get("document")
        if not doc:
            return None
        return {
            "file_id": doc.get("file_id"),
            "file_unique_id": doc.get("file_unique_id"),
            "file_name": doc.get("file_name", ""),
            "file_size": doc.get("file_size", 0),
            "message_id": pinned.get("message_id"),
        }


async def upload_vault_manifest(
    token: str,
    chat_id: str | int,
    manifest_bytes: bytes,
    filename: str,
    caption: str,
    auto_pin: bool = True,
    message_thread_id: int | None = None,
) -> dict[str, Any]:
    """Upload a vault JSON manifest and automatically pin it in the channel/topic."""
    res = await upload_document_to_telegram(
        token=token,
        chat_id=chat_id,
        file_path=manifest_bytes,
        filename=filename,
        caption=caption,
        message_thread_id=message_thread_id,
    )
    message_id = res.get("message_id")
    if auto_pin and message_id:
        try:
            await pin_chat_message(token, chat_id, message_id, disable_notification=True)
            res["pinned"] = True
        except Exception as e:
            log.warning("Failed to pin vault manifest message: %s", e)
            res["pinned"] = False
    return res


async def prune_backup_history(
    token: str,
    chat_id: str | int,
    history_file: Path,
    max_keep: int = 7,
) -> list[int]:
    """Prune old backup manifest messages so only the last max_keep remain in Telegram."""
    import json
    if not history_file.exists():
        return []
    try:
        history = json.loads(history_file.read_text())
    except Exception:
        return []

    if len(history) <= max_keep:
        return []

    to_prune = history[:-max_keep]
    retained = history[-max_keep:]
    deleted_ids: list[int] = []

    for item in to_prune:
        msg_id = item.get("message_id")
        if msg_id:
            try:
                ok = await delete_chat_message(token, chat_id, msg_id)
                if ok:
                    deleted_ids.append(msg_id)
            except Exception as e:
                log.warning("Failed to delete old manifest message %s: %s", msg_id, e)

    history_file.write_text(json.dumps(retained, indent=2))
    return deleted_ids

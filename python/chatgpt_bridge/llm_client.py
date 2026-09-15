"""OpenAI-compatible async LLM client for chat completion and connection testing."""

from __future__ import annotations

import json
import logging
import re
import time
from typing import Any

import httpx

log = logging.getLogger("chatgpt_bridge.llm_client")


def mask_api_key(key: str) -> str:
    """Mask an API key for safe display and logging (e.g. sk-...****)."""
    if not key:
        return ""
    stripped = key.strip()
    if len(stripped) <= 6:
        return "****"
    if stripped.startswith("sk-"):
        return "sk-...****"
    return f"{stripped[:4]}...****"


def extract_json(text: str) -> str:
    """Robustly extract valid JSON from LLM output that may include markdown or preamble."""
    trimmed = text.strip()
    # Fast path: already valid JSON
    try:
        json.loads(trimmed)
        return trimmed
    except Exception:
        pass

    # Match markdown code block ```json ... ``` or ``` ... ```
    code_block_match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", trimmed, re.IGNORECASE)
    if code_block_match:
        candidate = code_block_match.group(1).strip()
        try:
            json.loads(candidate)
            return candidate
        except Exception:
            pass

    # Match outermost JSON object { ... } or array [ ... ]
    outer_match = re.search(r"(\{[\s\S]*\}|\[[\s\S]*\])", trimmed)
    if outer_match:
        candidate = outer_match.group(1).strip()
        try:
            json.loads(candidate)
            return candidate
        except Exception:
            pass

    return trimmed


class OpenAICompatibleClient:
    """Async client communicating with any OpenAI-compatible API (OpenAI, OpenRouter, DeepSeek, Groq, Ollama)."""

    def __init__(
        self,
        timeout: float = 60.0,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self.timeout = timeout
        self.transport = transport

    async def test_connection(
        self,
        base_url: str,
        api_key: str = "",
        timeout: float | None = None,
    ) -> tuple[bool, str, list[str]]:
        """Validate connection by fetching the available models list.

        Returns:
            Tuple of (success: bool, status_or_latency_message: str, model_ids: list[str])
        """
        normalized_base = base_url.strip().rstrip("/")
        models_url = f"{normalized_base}/models"
        headers: dict[str, str] = {"Content-Type": "application/json"}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key.strip()}"

        effective_timeout = timeout or self.timeout
        t0 = time.perf_counter()

        try:
            async with httpx.AsyncClient(transport=self.transport, timeout=effective_timeout) as client:
                resp = await client.get(models_url, headers=headers)
            latency_ms = max(1, int((time.perf_counter() - t0) * 1000))

            if resp.status_code == 200:
                data = resp.json()
                models: list[str] = []
                if isinstance(data, dict):
                    items = data.get("data") or data.get("models") or []
                    if isinstance(items, list):
                        for item in items:
                            if isinstance(item, dict) and "id" in item:
                                models.append(str(item["id"]))
                            elif isinstance(item, dict) and "name" in item:
                                models.append(str(item["name"]))
                            elif isinstance(item, str):
                                models.append(item)
                elif isinstance(data, list):
                    for item in data:
                        if isinstance(item, dict) and "id" in item:
                            models.append(str(item["id"]))
                        elif isinstance(item, str):
                            models.append(item)

                return True, f"Connected ({latency_ms}ms)", models

            elif resp.status_code == 401:
                msg = "Unauthorized: Invalid API key (HTTP 401)"
                try:
                    err_data = resp.json()
                    if isinstance(err_data, dict) and "error" in err_data:
                        err = err_data["error"]
                        if isinstance(err, dict) and "message" in err:
                            msg = f"Unauthorized (HTTP 401): {err['message']}"
                        elif isinstance(err, str):
                            msg = f"Unauthorized (HTTP 401): {err}"
                except Exception:
                    pass
                return False, msg, []

            else:
                body_snippet = resp.text[:200]
                return False, f"HTTP {resp.status_code}: {body_snippet}", []

        except httpx.TimeoutException:
            return False, "Connection timed out", []
        except httpx.RequestError as exc:
            return False, f"Connection failed: {str(exc)}", []
        except Exception as exc:
            return False, f"Error: {str(exc)}", []

    async def chat_completion(
        self,
        base_url: str,
        api_key: str = "",
        model: str = "gpt-4o",
        messages: list[dict[str, Any]] | None = None,
        temperature: float = 0.7,
        json_mode: bool = False,
        timeout: float | None = None,
    ) -> str:
        """Call the OpenAI-compatible chat completions endpoint and return the response text."""
        normalized_base = base_url.strip().rstrip("/")
        completions_url = f"{normalized_base}/chat/completions"
        headers: dict[str, str] = {"Content-Type": "application/json"}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key.strip()}"

        payload: dict[str, Any] = {
            "model": model,
            "messages": messages or [],
            "temperature": temperature,
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}

        effective_timeout = timeout or self.timeout

        async with httpx.AsyncClient(transport=self.transport, timeout=effective_timeout) as client:
            resp = await client.post(completions_url, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()

        raw_content = ""
        if isinstance(data, dict) and "choices" in data and len(data["choices"]) > 0:
            choice = data["choices"][0]
            if isinstance(choice, dict) and "message" in choice:
                raw_content = choice["message"].get("content") or ""

        if json_mode:
            return extract_json(raw_content)
        return raw_content


# ── Module-level convenience functions ──


async def test_connection(
    base_url: str,
    api_key: str = "",
    timeout: float | None = None,
) -> tuple[bool, str, list[str]]:
    """Convenience wrapper for OpenAICompatibleClient.test_connection."""
    return await OpenAICompatibleClient().test_connection(base_url, api_key, timeout=timeout)


async def chat_completion(
    base_url: str,
    api_key: str = "",
    model: str = "gpt-4o",
    messages: list[dict[str, Any]] | None = None,
    temperature: float = 0.7,
    json_mode: bool = False,
    timeout: float | None = None,
) -> str:
    """Convenience wrapper for OpenAICompatibleClient.chat_completion."""
    return await OpenAICompatibleClient().chat_completion(
        base_url=base_url,
        api_key=api_key,
        model=model,
        messages=messages,
        temperature=temperature,
        json_mode=json_mode,
        timeout=timeout,
    )

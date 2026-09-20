"""OpenAI-compatible async LLM client for chat completion and connection testing."""

from __future__ import annotations

import json
import logging
import re
import time
from typing import Any

import httpx

log = logging.getLogger("chatgpt_bridge.llm_client")

DEFAULT_TIMEOUT: float = 300.0


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


def normalize_base_url(base_url: str) -> str:
    """Normalize OpenAI-compatible base URL, including Google Gemini endpoints."""
    url = (base_url or "").strip().rstrip("/")
    if "generativelanguage.googleapis.com" in url:
        if not url.endswith("/openai"):
            if not url.endswith("/v1beta"):
                url = f"{url}/v1beta/openai"
            else:
                url = f"{url}/openai"
    return url


DEFAULT_PROVIDERS: list[dict[str, Any]] = [
    {
        "id": "gemini",
        "name": "Google Gemini",
        "base_url": "https://generativelanguage.googleapis.com/v1beta/openai/",
        "api_key_placeholder": "AIzaSy...",
        "default_model": "gemini-2.5-flash",
        "is_popular": True,
        "hint": "Free tier API key available from Google AI Studio. Native multimodal reasoning.",
        "default_models": [
            "gemini-2.5-flash",
            "gemini-2.5-pro",
            "gemini-2.0-flash",
            "gemini-1.5-flash",
            "gemini-1.5-pro",
        ],
    },
    {
        "id": "openai",
        "name": "OpenAI",
        "base_url": "https://api.openai.com/v1",
        "api_key_placeholder": "sk-proj-...",
        "default_model": "gpt-4o-mini",
        "is_popular": True,
        "hint": "Flagship GPT-4o and lightweight GPT-4o-mini models.",
        "default_models": [
            "gpt-4o",
            "gpt-4o-mini",
            "o3-mini",
            "o1",
            "o1-mini",
            "gpt-4-turbo",
        ],
    },
    {
        "id": "groq",
        "name": "Groq Cloud",
        "base_url": "https://api.groq.com/openai/v1",
        "api_key_placeholder": "gsk_...",
        "default_model": "llama-3.3-70b-versatile",
        "is_popular": True,
        "hint": "Ultra-fast LPU inference (500+ tokens/sec). Generous free tier.",
        "default_models": [
            "llama-3.3-70b-versatile",
            "llama3-70b-8192",
            "llama3-8b-8192",
            "mixtral-8x7b-32768",
        ],
    },
    {
        "id": "openrouter",
        "name": "OpenRouter",
        "base_url": "https://openrouter.ai/api/v1",
        "api_key_placeholder": "sk-or-...",
        "default_model": "anthropic/claude-3-5-sonnet",
        "is_popular": False,
        "hint": "Universal aggregator routing to Claude, DeepSeek R1, Llama 3.3, and more.",
        "default_models": [
            "anthropic/claude-3-7-sonnet",
            "anthropic/claude-3-5-sonnet",
            "anthropic/claude-3-5-haiku",
            "deepseek/deepseek-r1",
            "deepseek/deepseek-chat",
            "meta-llama/llama-3.3-70b-instruct",
            "google/gemini-2.5-flash",
            "google/gemini-2.5-pro",
        ],
    },
    {
        "id": "deepseek",
        "name": "DeepSeek",
        "base_url": "https://api.deepseek.com/v1",
        "api_key_placeholder": "sk-...",
        "default_model": "deepseek-chat",
        "is_popular": False,
        "hint": "DeepSeek-V3 chat and DeepSeek-R1 deep reasoning models.",
        "default_models": [
            "deepseek-chat",
            "deepseek-reasoner",
        ],
    },
    {
        "id": "ollama",
        "name": "Ollama (Local)",
        "base_url": "http://localhost:11434/v1",
        "api_key_placeholder": "ollama (optional)",
        "default_model": "llama3",
        "is_popular": False,
        "hint": "Private local offline models running on your own machine.",
        "default_models": [
            "llama3",
            "llama3.2",
            "mistral",
            "qwen2.5",
        ],
    },
    {
        "id": "nim",
        "name": "NVIDIA NIM",
        "base_url": "http://nim.ajaxhs.home/v1",
        "api_key_placeholder": "nvapi-... (optional for local)",
        "default_model": "nvidia/nemotron-3-super-120b-a12b",
        "is_popular": True,
        "hint": "High-throughput local/private enterprise inference.",
        "default_models": [
            "nvidia/nemotron-3-super-120b-a12b",
            "meta/llama-3.3-70b-instruct",
            "mistralai/mistral-large-2-instruct",
        ],
    },
]


def get_providers_config(settings: dict[str, Any]) -> dict[str, dict[str, Any]]:
    """Return dictionary of configured providers, migrating legacy settings if needed."""
    raw = settings.get("providers")
    providers: dict[str, dict[str, Any]] = {}

    if isinstance(raw, dict) and raw:
        for pid, pdata in raw.items():
            if isinstance(pdata, dict):
                providers[pid] = dict(pdata)
    else:
        # Seed built-in provider templates
        for p in DEFAULT_PROVIDERS:
            pid = p["id"]
            providers[pid] = {
                "id": pid,
                "name": p["name"],
                "base_url": p["base_url"],
                "api_key": "",
                "enabled": True,
                "custom_models": [],
                "discovered_models": list(p.get("default_models", [])),
                "hint": p.get("hint", ""),
                "is_popular": p.get("is_popular", False),
            }

        # Migrate from legacy single-provider settings
        legacy_base = settings.get("llm_base_url") or ""
        legacy_key = settings.get("llm_api_key") or ""
        legacy_custom = settings.get("custom_models") or []

        if legacy_base or legacy_key:
            target_pid = "gemini" if "generativelanguage.googleapis.com" in legacy_base else (
                "openai" if "api.openai.com" in legacy_base else (
                    "groq" if "groq.com" in legacy_base else (
                        "openrouter" if "openrouter.ai" in legacy_base else (
                            "deepseek" if "deepseek.com" in legacy_base else (
                                "ollama" if "11434" in legacy_base else "custom_primary"
                            )
                        )
                    )
                )
            )
            if target_pid in providers:
                if legacy_base:
                    providers[target_pid]["base_url"] = legacy_base
                if legacy_key:
                    providers[target_pid]["api_key"] = legacy_key
                if legacy_custom:
                    providers[target_pid]["custom_models"] = list(set(legacy_custom))
            else:
                providers[target_pid] = {
                    "id": target_pid,
                    "name": "Custom Endpoint",
                    "base_url": legacy_base,
                    "api_key": legacy_key,
                    "enabled": True,
                    "custom_models": list(legacy_custom),
                    "discovered_models": [],
                }

    # Ensure all default providers exist as base entries
    for p in DEFAULT_PROVIDERS:
        pid = p["id"]
        if pid not in providers:
            providers[pid] = {
                "id": pid,
                "name": p["name"],
                "base_url": p["base_url"],
                "api_key": "",
                "enabled": True,
                "custom_models": [],
                "discovered_models": list(p.get("default_models", [])),
                "hint": p.get("hint", ""),
                "is_popular": p.get("is_popular", False),
            }

    return providers


def get_assignments_config(settings: dict[str, Any]) -> dict[str, dict[str, str]]:
    """Return task assignments: director & enhancer mapping to provider_id + model."""
    raw = settings.get("assignments")
    assignments: dict[str, dict[str, str]] = {}
    if isinstance(raw, dict):
        for role in ("director", "enhancer"):
            if role in raw and isinstance(raw[role], dict):
                assignments[role] = {
                    "provider_id": str(raw[role].get("provider_id") or ""),
                    "model": str(raw[role].get("model") or ""),
                }

    # Fallback to legacy director_model / enhancer_model if not set
    if "director" not in assignments or not assignments["director"].get("model"):
        d_model = settings.get("director_model") or settings.get("llm_director_model") or settings.get("llm_model") or "gemini-2.5-pro"
        pid = "gemini" if "gemini" in d_model.lower() else (
            "openai" if ("gpt" in d_model.lower() or "o1" in d_model.lower() or "o3" in d_model.lower()) else (
                "groq" if "llama" in d_model.lower() else "gemini"
            )
        )
        assignments["director"] = {"provider_id": pid, "model": d_model}

    if "enhancer" not in assignments or not assignments["enhancer"].get("model"):
        e_model = settings.get("enhancer_model") or settings.get("llm_enhancer_model") or settings.get("director_model") or "gemini-2.5-flash"
        pid = "gemini" if "gemini" in e_model.lower() else (
            "openai" if ("gpt" in e_model.lower() or "o1" in e_model.lower() or "o3" in e_model.lower()) else (
                "groq" if "llama" in e_model.lower() else "gemini"
            )
        )
        assignments["enhancer"] = {"provider_id": pid, "model": e_model}

    return assignments


def resolve_llm_execution(
    settings: dict[str, Any],
    role: str,
    requested_provider_id: str | None = None,
    requested_model: str | None = None,
) -> tuple[str, str, str, str]:
    """Resolve (base_url, api_key, model, provider_id) for execution.

    Takes explicit request overrides first, then role assignment, then provider configuration.
    """
    providers = get_providers_config(settings)
    assignments = get_assignments_config(settings)

    provider_id = (requested_provider_id or "").strip()
    model = (requested_model or "").strip()

    if not provider_id or not model:
        role_assign = assignments.get(role, {})
        if not provider_id:
            provider_id = role_assign.get("provider_id", "")
        if not model:
            model = role_assign.get("model", "")

    # If provider_id not in configured providers, match by model name or fallback
    target_prov: dict[str, Any] | None = None
    if provider_id and provider_id in providers:
        target_prov = providers[provider_id]
    else:
        # Try inferring provider from model name
        if "gemini" in model.lower():
            target_prov = providers.get("gemini")
            provider_id = "gemini"
        elif "gpt-" in model.lower() or model.startswith("o1") or model.startswith("o3"):
            target_prov = providers.get("openai")
            provider_id = "openai"
        elif "llama" in model.lower() or "mixtral" in model.lower():
            target_prov = providers.get("groq") or providers.get("ollama")
            provider_id = "groq" if "groq" in providers else "ollama"
        elif "claude" in model.lower():
            target_prov = providers.get("openrouter")
            provider_id = "openrouter"
        elif "deepseek" in model.lower():
            target_prov = providers.get("deepseek") or providers.get("openrouter")
            provider_id = "deepseek"

    if not target_prov:
        # Fallback to any provider that has an API key configured
        for p in providers.values():
            if p.get("api_key") and p.get("enabled", True):
                target_prov = p
                provider_id = p["id"]
                break

    if not target_prov:
        # Ultimate fallback
        target_prov = providers.get("gemini") or next(iter(providers.values()))
        provider_id = target_prov.get("id", "gemini")

    base_url = target_prov.get("base_url") or "https://generativelanguage.googleapis.com/v1beta/openai/"
    api_key = target_prov.get("api_key") or ""
    if not model:
        model = target_prov.get("default_model") or "gemini-2.5-flash"

    return base_url, api_key, model, provider_id


class OpenAICompatibleClient:
    """Async client communicating with any OpenAI-compatible API (Google Gemini, OpenAI, OpenRouter, DeepSeek, Groq, Ollama, NIM)."""

    def __init__(
        self,
        transport: httpx.AsyncBaseTransport | None = None,
        timeout: float = DEFAULT_TIMEOUT,
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
        normalized_base = normalize_base_url(base_url)
        headers: dict[str, str] = {"Content-Type": "application/json"}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key.strip()}"

        candidate_requests: list[tuple[str, dict[str, str]]] = []
        is_gemini = "generativelanguage.googleapis.com" in base_url or "generativelanguage.googleapis.com" in normalized_base

        if is_gemini:
            key_param = f"&key={api_key.strip()}" if api_key.strip() else ""
            gemini_headers: dict[str, str] = {"Content-Type": "application/json"}
            if api_key.strip():
                gemini_headers["x-goog-api-key"] = api_key.strip()
            # Primary: Native Google Gemini models listing endpoint with pageSize=1000 to fetch ALL models
            candidate_requests.append((f"https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000{key_param}", gemini_headers))
            # Secondary: in case Gemini adds an OpenAI models proxy
            candidate_requests.append((f"{normalized_base}/models", headers))
        else:
            candidate_requests.append((f"{normalized_base}/models", headers))
            if "/openai" in normalized_base:
                alt = normalized_base.replace("/openai", "")
                candidate_requests.append((f"{alt}/models", headers))
            if not normalized_base.endswith("/v1"):
                candidate_requests.append((f"{normalized_base}/v1/models", headers))
            if "localhost:11434" in base_url or "127.0.0.1:11434" in base_url or "ollama" in base_url.lower():
                base_clean = base_url.split("/v1")[0].rstrip("/")
                candidate_requests.append((f"{base_clean}/api/tags", headers))

        effective_timeout = timeout or self.timeout
        t0 = time.perf_counter()
        last_error_msg = "No response"

        for models_url, req_headers in candidate_requests:
            try:
                async with httpx.AsyncClient(transport=self.transport, timeout=effective_timeout) as client:
                    resp = await client.get(models_url, headers=req_headers)
                    latency_ms = max(1, int((time.perf_counter() - t0) * 1000))

                    if resp.status_code == 200:
                        data = resp.json()
                        items: list[Any] = []
                        if isinstance(data, dict):
                            items.extend(data.get("data") or data.get("models") or [])
                            # Follow pagination if available to collect ALL models
                            next_token = data.get("nextPageToken")
                            page_count = 0
                            while next_token and page_count < 10:
                                page_count += 1
                                sep = "&" if "?" in models_url else "?"
                                next_url = f"{models_url}{sep}pageToken={next_token}"
                                try:
                                    next_resp = await client.get(next_url, headers=req_headers)
                                    if next_resp.status_code == 200:
                                        next_data = next_resp.json()
                                        if isinstance(next_data, dict):
                                            items.extend(next_data.get("data") or next_data.get("models") or [])
                                            next_token = next_data.get("nextPageToken")
                                        else:
                                            break
                                    else:
                                        break
                                except Exception:
                                    break
                        elif isinstance(data, list):
                            items.extend(data)

                        models: list[str] = []
                        for item in items:
                            m_id = None
                            if isinstance(item, dict):
                                methods = item.get("supportedGenerationMethods") or []
                                if methods and "generateContent" not in methods:
                                    continue
                                m_id = item.get("id") or item.get("name")
                            elif isinstance(item, str):
                                m_id = item
                            if m_id:
                                m_str = str(m_id)
                                if m_str.startswith("models/"):
                                    m_str = m_str.removeprefix("models/")
                                models.append(m_str)

                        # Deduplicate while preserving order
                        seen_models = set()
                        unique_models = []
                        for m in models:
                            if m not in seen_models:
                                seen_models.add(m)
                                unique_models.append(m)

                        return True, f"Connected ({latency_ms}ms)", unique_models

                    elif resp.status_code == 404:
                        # Try next candidate URL
                        last_error_msg = f"HTTP 404: Endpoint {models_url} not found"
                        continue

                    elif resp.status_code in (400, 401, 403):
                        msg = f"Auth Error (HTTP {resp.status_code})"
                        try:
                            err_data = resp.json()
                            err_obj = None
                            if isinstance(err_data, dict) and "error" in err_data:
                                err_obj = err_data["error"]
                            elif isinstance(err_data, list) and len(err_data) > 0 and isinstance(err_data[0], dict) and "error" in err_data[0]:
                                err_obj = err_data[0]["error"]
                            if isinstance(err_obj, dict) and "message" in err_obj:
                                msg = f"Auth Error (HTTP {resp.status_code}): {err_obj['message']}"
                            elif isinstance(err_obj, str):
                                msg = f"Auth Error (HTTP {resp.status_code}): {err_obj}"
                        except Exception:
                            pass
                        return False, msg, []

                    else:
                        msg = f"HTTP {resp.status_code}"
                        try:
                            err_data = resp.json()
                            err_obj = None
                            if isinstance(err_data, dict) and "error" in err_data:
                                err_obj = err_data["error"]
                            elif isinstance(err_data, list) and len(err_data) > 0 and isinstance(err_data[0], dict) and "error" in err_data[0]:
                                err_obj = err_data[0]["error"]
                            if isinstance(err_obj, dict) and "message" in err_obj:
                                msg = f"HTTP {resp.status_code}: {err_obj['message']}"
                            elif isinstance(err_obj, str):
                                msg = f"HTTP {resp.status_code}: {err_obj}"
                        except Exception:
                            body_snippet = resp.text[:200]
                            msg = f"HTTP {resp.status_code}: {body_snippet}"
                        last_error_msg = msg

            except httpx.TimeoutException:
                last_error_msg = "Connection timed out"
            except httpx.RequestError as exc:
                last_error_msg = f"Connection failed: {str(exc)}"
            except Exception as exc:
                last_error_msg = f"Error: {str(exc)}"

        return False, last_error_msg, []

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
        normalized_base = normalize_base_url(base_url)
        completions_url = f"{normalized_base}/chat/completions"
        headers: dict[str, str] = {"Content-Type": "application/json"}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key.strip()}"
            if "generativelanguage.googleapis.com" in normalized_base:
                headers["x-goog-api-key"] = api_key.strip()

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
            if resp.status_code != 200:
                err_msg = f"HTTP {resp.status_code}"
                try:
                    err_data = resp.json()
                    err_obj = None
                    if isinstance(err_data, dict) and "error" in err_data:
                        err_obj = err_data["error"]
                    elif isinstance(err_data, list) and len(err_data) > 0 and isinstance(err_data[0], dict) and "error" in err_data[0]:
                        err_obj = err_data[0]["error"]
                    if isinstance(err_obj, dict) and "message" in err_obj:
                        err_msg = f"{err_msg}: {err_obj['message']}"
                    elif isinstance(err_obj, str):
                        err_msg = f"{err_msg}: {err_obj}"
                except Exception:
                    err_msg = f"{err_msg}: {resp.text[:200]}"
                raise httpx.HTTPStatusError(err_msg, request=resp.request, response=resp)
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

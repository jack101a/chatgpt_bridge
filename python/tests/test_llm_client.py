"""Tests for OpenAI-compatible client and LLM configuration endpoints."""

from __future__ import annotations

import json
from pathlib import Path
import pytest
import httpx
from fastapi.testclient import TestClient

from chatgpt_bridge.llm_client import (
    OpenAICompatibleClient,
    extract_json,
    mask_api_key,
)
import chatgpt_bridge.daemon as daemon


# ── Fixtures & Mock Transports ──


@pytest.fixture
def mock_models_transport():
    """Mock transport returning OpenAI models list."""
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers.get("authorization") == "Bearer test-key"
        if request.url.path.endswith("/models"):
            return httpx.Response(
                200,
                json={
                    "object": "list",
                    "data": [
                        {"id": "gpt-4o", "object": "model"},
                        {"id": "gpt-4o-mini", "object": "model"},
                    ],
                },
            )
        return httpx.Response(404, json={"error": "not found"})

    return httpx.MockTransport(handler)


@pytest.fixture
def mock_unauthorized_transport():
    """Mock transport returning 401 Unauthorized."""
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            401,
            json={"error": {"message": "Incorrect API key provided"}},
        )

    return httpx.MockTransport(handler)


@pytest.fixture
def mock_timeout_transport():
    """Mock transport simulating connection timeout."""
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectTimeout("Connection timed out after 10s")

    return httpx.MockTransport(handler)


@pytest.fixture
def mock_chat_transport():
    """Mock transport returning chat completion responses."""
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers.get("authorization") == "Bearer test-key"
        if request.url.path.endswith("/chat/completions"):
            body = json.loads(request.content.decode("utf-8"))
            messages = body.get("messages", [])
            last_prompt = messages[-1]["content"] if messages else ""

            if "return_markdown_json" in last_prompt:
                content = (
                    "Here is your structured plan:\n```json\n"
                    '{"shots": [{"id": 1, "prompt": "shot one"}]}\n'
                    "```\nHope you like it!"
                )
            elif "return_surrounded_json" in last_prompt:
                content = 'Sure thing: {"status": "ok", "count": 2} let me know if you need more.'
            elif "return_plain_text" in last_prompt:
                content = "This is plain text response."
            else:
                content = '{"plan": "cinematic intro", "shots": []}'

            return httpx.Response(
                200,
                json={
                    "id": "chatcmpl-123",
                    "choices": [
                        {
                            "index": 0,
                            "message": {
                                "role": "assistant",
                                "content": content,
                            },
                            "finish_reason": "stop",
                        }
                    ],
                },
            )
        return httpx.Response(404)

    return httpx.MockTransport(handler)


# ── Unit Tests: OpenAICompatibleClient ──


@pytest.mark.anyio
async def test_test_connection_success(mock_models_transport):
    client = OpenAICompatibleClient(transport=mock_models_transport)
    ok, message, models = await client.test_connection(
        base_url="https://api.openai.com/v1",
        api_key="test-key",
    )
    assert ok is True
    assert "Connected" in message
    assert "ms" in message
    assert models == ["gpt-4o", "gpt-4o-mini"]


@pytest.mark.anyio
async def test_test_connection_unauthorized(mock_unauthorized_transport):
    client = OpenAICompatibleClient(transport=mock_unauthorized_transport)
    ok, message, models = await client.test_connection(
        base_url="https://api.openai.com/v1",
        api_key="test-key",
    )
    assert ok is False
    assert "401" in message or "Unauthorized" in message or "Incorrect API key" in message
    assert models == []


@pytest.mark.anyio
async def test_test_connection_timeout(mock_timeout_transport):
    client = OpenAICompatibleClient(transport=mock_timeout_transport)
    ok, message, models = await client.test_connection(
        base_url="https://api.openai.com/v1",
        api_key="test-key",
    )
    assert ok is False
    assert "timeout" in message.lower() or "timed out" in message.lower()
    assert models == []


@pytest.mark.anyio
async def test_test_connection_network_error():
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("Failed to resolve host")

    client = OpenAICompatibleClient(transport=httpx.MockTransport(handler))
    ok, message, models = await client.test_connection(
        base_url="https://invalid.openai.domain/v1",
        api_key="test-key",
    )
    assert ok is False
    assert "Failed to resolve host" in message or "ConnectError" in message
    assert models == []


@pytest.mark.anyio
async def test_chat_completion_plain_text(mock_chat_transport):
    client = OpenAICompatibleClient(transport=mock_chat_transport)
    result = await client.chat_completion(
        base_url="https://api.openai.com/v1",
        api_key="test-key",
        model="gpt-4o",
        messages=[{"role": "user", "content": "return_plain_text"}],
        json_mode=False,
    )
    assert result == "This is plain text response."


@pytest.mark.anyio
async def test_chat_completion_json_mode_markdown(mock_chat_transport):
    client = OpenAICompatibleClient(transport=mock_chat_transport)
    result = await client.chat_completion(
        base_url="https://api.openai.com/v1",
        api_key="test-key",
        model="gpt-4o",
        messages=[{"role": "user", "content": "return_markdown_json"}],
        json_mode=True,
    )
    parsed = json.loads(result)
    assert "shots" in parsed
    assert len(parsed["shots"]) == 1
    assert parsed["shots"][0]["prompt"] == "shot one"


@pytest.mark.anyio
async def test_chat_completion_json_mode_surrounded(mock_chat_transport):
    client = OpenAICompatibleClient(transport=mock_chat_transport)
    result = await client.chat_completion(
        base_url="https://api.openai.com/v1",
        api_key="test-key",
        model="gpt-4o",
        messages=[{"role": "user", "content": "return_surrounded_json"}],
        json_mode=True,
    )
    parsed = json.loads(result)
    assert parsed == {"status": "ok", "count": 2}


@pytest.mark.anyio
async def test_chat_completion_http_error():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, json={"error": "Internal server error"})

    client = OpenAICompatibleClient(transport=httpx.MockTransport(handler))
    with pytest.raises(httpx.HTTPStatusError):
        await client.chat_completion(
            base_url="https://api.openai.com/v1",
            api_key="test-key",
            model="gpt-4o",
            messages=[{"role": "user", "content": "hello"}],
        )


# ── Unit Tests: Helpers ──


def test_extract_json():
    # Direct valid json
    assert extract_json('{"a": 1}') == '{"a": 1}'
    # Markdown json codeblock
    assert extract_json('```json\n{"b": 2}\n```') == '{"b": 2}'
    # Text surrounded json
    assert extract_json('Leading text {"c": 3} trailing text') == '{"c": 3}'
    # List JSON
    assert extract_json('Here is list: [1, 2, 3]') == '[1, 2, 3]'


def test_mask_api_key():
    assert mask_api_key("") == ""
    assert mask_api_key("short") == "****"
    assert mask_api_key("sk-proj-1234567890abcdef") == "sk-...****"
    assert mask_api_key("gsk_1234567890abcdef") == "gsk_...****"


# ── Daemon Endpoints Tests ──


@pytest.fixture
def test_client(tmp_path, monkeypatch):
    """TestClient with isolated settings file and mocked core."""
    settings_file = tmp_path / "settings.json"
    monkeypatch.setattr(daemon, "SETTINGS_FILE", settings_file)

    class _FakeCore:
        pass

    monkeypatch.setattr(daemon, "_get_core", lambda: _FakeCore())
    return TestClient(daemon.app)


def test_daemon_llm_config_get_default(test_client):
    resp = test_client.get("/api/llm/config")
    assert resp.status_code == 200
    data = resp.json()
    assert "base_url" in data
    assert data["api_key"] == ""
    assert "model" in data


def test_daemon_llm_config_post_and_get(test_client):
    post_resp = test_client.post(
        "/api/llm/config",
        json={
            "base_url": "https://openrouter.ai/api/v1",
            "api_key": "sk-or-v1-abcdef123456",
            "model": "anthropic/claude-3.5-sonnet",
        },
    )
    assert post_resp.status_code == 200
    post_data = post_resp.json()
    assert post_data["base_url"] == "https://openrouter.ai/api/v1"
    assert post_data["api_key"] == "sk-...****"
    assert post_data["model"] == "anthropic/claude-3.5-sonnet"
    assert post_data["has_key"] is True

    # Verify GET retrieves the updated settings with masked key
    get_resp = test_client.get("/api/llm/config")
    assert get_resp.status_code == 200
    get_data = get_resp.json()
    assert get_data["base_url"] == "https://openrouter.ai/api/v1"
    assert get_data["api_key"] == "sk-...****"
    assert get_data["model"] == "anthropic/claude-3.5-sonnet"
    assert get_data["has_key"] is True


def test_daemon_llm_config_preserves_key_when_masked_submitted(test_client):
    # Initial save
    test_client.post(
        "/api/llm/config",
        json={
            "base_url": "https://api.openai.com/v1",
            "api_key": "sk-real-secret-key-123456",
            "model": "gpt-4o",
        },
    )

    # Submitting with masked key should not overwrite real key
    update_resp = test_client.post(
        "/api/llm/config",
        json={
            "base_url": "https://api.openai.com/v1",
            "api_key": "sk-...****",
            "model": "gpt-4o-mini",
        },
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["model"] == "gpt-4o-mini"
    assert update_resp.json()["api_key"] == "sk-...****"

    # Verify underlying file has original secret key
    settings = json.loads(daemon.SETTINGS_FILE.read_text(encoding="utf-8"))
    assert settings["llm_api_key"] == "sk-real-secret-key-123456"
    assert settings["llm_model"] == "gpt-4o-mini"


def test_daemon_llm_test_endpoint_success(test_client, monkeypatch):
    async def mock_test_connection(self, base_url, api_key):
        assert base_url == "https://api.openai.com/v1"
        assert api_key == "sk-test-token"
        return True, "Connected (95ms)", ["gpt-4o", "gpt-4o-mini"]

    monkeypatch.setattr(OpenAICompatibleClient, "test_connection", mock_test_connection)

    resp = test_client.post(
        "/api/llm/test",
        json={
            "base_url": "https://api.openai.com/v1",
            "api_key": "sk-test-token",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is True
    assert "Connected" in data["message"]
    assert data["models"] == ["gpt-4o", "gpt-4o-mini"]


def test_daemon_llm_test_endpoint_using_stored_credentials(test_client, monkeypatch):
    # Store settings first
    test_client.post(
        "/api/llm/config",
        json={
            "base_url": "https://api.deepseek.com/v1",
            "api_key": "sk-deepseek-secret",
            "model": "deepseek-chat",
        },
    )

    called = {}

    async def mock_test_connection(self, base_url, api_key):
        called["base_url"] = base_url
        called["api_key"] = api_key
        return True, "Connected (110ms)", ["deepseek-chat"]

    monkeypatch.setattr(OpenAICompatibleClient, "test_connection", mock_test_connection)

    # Post without body / empty body
    resp = test_client.post("/api/llm/test", json={})
    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is True
    assert called["base_url"] == "https://api.deepseek.com/v1"
    assert called["api_key"] == "sk-deepseek-secret"

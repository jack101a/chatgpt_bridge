import base64
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient
from chatgpt_bridge.daemon import app


@pytest.fixture
def client():
    return TestClient(app)


def test_v1_models_endpoint(client):
    """Test that /v1/models returns only the actual supported models."""
    resp = client.get("/v1/models")
    assert resp.status_code == 200
    data = resp.json()
    assert data["object"] == "list"
    ids = [m["id"] for m in data["data"]]
    assert ids == ["chatgpt", "chatgpt-thinking"]


def test_v1_chat_completions_non_streaming(client):
    """Test standard non-streaming OpenAI chat completion."""
    mock_ask_result = {
        "response": "def add(a, b):\n    return a + b",
        "conversation_id": "conv-test-123",
        "account_used": "TestAccount",
    }

    with patch("chatgpt_bridge.daemon.ask", new_callable=AsyncMock) as mock_ask:
        mock_ask.return_value = mock_ask_result
        payload = {
            "model": "chatgpt",
            "messages": [
                {"role": "system", "content": "You are a code generator."},
                {"role": "user", "content": "Write an add function"},
            ],
            "stream": False,
        }
        resp = client.post("/v1/chat/completions", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["object"] == "chat.completion"
        assert len(data["choices"]) == 1
        assert data["choices"][0]["message"]["content"] == "def add(a, b):\n    return a + b"
        assert data["choices"][0]["finish_reason"] == "stop"
        assert data["thinking"] is False

        # Verify ask was called with system context prepended
        mock_ask.assert_called_once()
        call_req = mock_ask.call_args[0][0]
        assert "[System Context]" in call_req.prompt
        assert "Write an add function" in call_req.prompt
        assert call_req.thinking is False


def test_v1_chat_completions_thinking_mode_flag(client):
    """Test thinking mode activation via model name keyword."""
    mock_ask_result = {
        "response": "Step 1: Analyze types... Step 2: Implement",
        "conversation_id": "conv-test-456",
        "account_used": "TestAccount",
    }

    with patch("chatgpt_bridge.daemon.ask", new_callable=AsyncMock) as mock_ask:
        mock_ask.return_value = mock_ask_result
        payload = {
            "model": "chatgpt-thinking",
            "messages": [{"role": "user", "content": "Solve this complex puzzle"}],
        }
        resp = client.post("/v1/chat/completions", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["thinking"] is True
        call_req = mock_ask.call_args[0][0]
        assert call_req.thinking is True


def test_v1_chat_completions_streaming(client):
    """Test streaming SSE OpenAI chat completion."""
    mock_ask_result = {
        "response": "Streaming code response",
        "conversation_id": "conv-stream",
        "account_used": "TestAccount",
    }

    with patch("chatgpt_bridge.daemon.ask", new_callable=AsyncMock) as mock_ask:
        mock_ask.return_value = mock_ask_result
        payload = {
            "model": "gpt-5-6-t-mini",
            "messages": [{"role": "user", "content": "Stream this"}],
            "stream": True,
        }
        resp = client.post("/v1/chat/completions", json=payload)
        assert resp.status_code == 200
        assert "text/event-stream" in resp.headers["content-type"]
        text = resp.text
        assert "data: " in text
        assert "data: [DONE]" in text
        assert "Streaming code response" in text


def test_api_docs_json_endpoint(client):
    """Test /api/docs returns machine-readable JSON metadata for curl/IDEs."""
    resp = client.get("/api/docs", headers={"Accept": "application/json"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "ChatGPT Bridge API & IDE Hub"
    assert "chat_completions" in data["endpoints"]
    assert "opencode" in data["ide_presets"]
    assert data["thinking_mode"]["supported"] is True


def test_api_docs_redirect_browser(client):
    """Test /api/docs redirects HTML browsers to /docs."""
    resp = client.get("/api/docs", headers={"Accept": "text/html"}, follow_redirects=False)
    assert resp.status_code in (302, 307)
    assert resp.headers["location"] == "/docs"


def test_docs_endpoints(client):
    """Test /docs and /api/docs/ui render valid Scalar interactive documentation."""
    resp_docs = client.get("/docs")
    assert resp_docs.status_code == 200
    assert "api-reference" in resp_docs.text
    assert "@scalar/api-reference" in resp_docs.text
    assert "ChatGPT Bridge API Reference" in resp_docs.text

    resp_ui = client.get("/api/docs/ui")
    assert resp_ui.status_code == 200
    assert "api-reference" in resp_ui.text


def test_api_docs_raw_markdown(client):
    """Test /api/docs/raw returns Markdown guide."""
    resp = client.get("/api/docs/raw")
    assert resp.status_code == 200
    assert "text/markdown" in resp.headers["content-type"]
    assert "ChatGPT Bridge" in resp.text
    assert "OpenCode" in resp.text


def test_concurrency_semaphores_configured():
    """Test that 2+1 concurrency architecture is active (2 chat slots, 1 image slot)."""
    from chatgpt_bridge.daemon import _chat_semaphore, _image_semaphore
    assert _chat_semaphore._value == 2
    assert _image_semaphore._value == 1


def test_client_id_conversation_isolation(client):
    """Test that X-Client-ID header namespaces conversations across different IDE clients."""
    from chatgpt_bridge.daemon import _client_conversations
    _client_conversations.clear()

    mock_core = MagicMock()
    mock_core.ask = AsyncMock(side_effect=[
        {"response": "OpenCode reply 1", "conversation_id": "cid-opencode-1"},
        {"response": "OpenClaw reply 1", "conversation_id": "cid-openclaw-1"},
        {"response": "OpenCode reply 2", "conversation_id": "cid-opencode-1"},
    ])

    with patch("chatgpt_bridge.daemon._get_core", return_value=mock_core):
        # 1. OpenCode client asks without cid -> gets assigned cid-opencode-1
        r1 = client.post(
            "/api/ask",
            json={"prompt": "Code from OpenCode"},
            headers={"X-Client-ID": "opencode"},
        )
        assert r1.status_code == 200
        assert _client_conversations.get("opencode") == "cid-opencode-1"

        # 2. OpenClaw client asks -> gets its own independent thread cid-openclaw-1
        r2 = client.post(
            "/api/ask",
            json={"prompt": "Code from OpenClaw"},
            headers={"X-Client-ID": "openclaw"},
        )
        assert r2.status_code == 200
        assert _client_conversations.get("openclaw") == "cid-openclaw-1"

        # 3. OpenCode asks again without cid -> automatically carries over cid-opencode-1!
        r3 = client.post(
            "/api/ask",
            json={"prompt": "Second code from OpenCode"},
            headers={"X-Client-ID": "opencode"},
        )
        assert r3.status_code == 200
        # Check call args of the 3rd invocation: conversation_id must be "cid-opencode-1"
        third_call_cid = mock_core.ask.call_args_list[2][1]["conversation_id"]
        assert third_call_cid == "cid-opencode-1"


def test_openapi_internal_endpoints_hidden():
    """Test that internal dashboard and admin endpoints are hidden from the public OpenAPI schema."""
    schema = app.openapi()
    paths = schema.get("paths", {})

    # Internal endpoints MUST NOT appear in public docs
    assert "/accounts/switch" not in paths
    assert "/accounts" not in paths
    assert "/api/accounts" not in paths
    assert "/api/storage/status" not in paths
    assert "/api/prompt-library" not in paths
    assert "/api/prompt-gallery" not in paths
    assert "/api/characters" not in paths
    assert "/api/director/execute" not in paths
    assert "/api/state" not in paths

    # Public endpoints MUST appear in public docs
    assert "/v1/chat/completions" in paths
    assert "/v1/models" in paths
    assert "/v1/images/edits" in paths
    assert "/api/upload" in paths
    assert "/api/ask" in paths
    assert "/image" in paths
    assert "/api/accounts/quota" in paths
    assert "/health" in paths
    assert "/status" in paths


def test_api_upload_multipart_and_base64(client):
    # 1x1 transparent PNG in base64
    tiny_png_b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    tiny_png_bytes = base64.b64decode(tiny_png_b64)

    # 1. Test Multipart Upload
    files = {"file": ("test_pic.png", tiny_png_bytes, "image/png")}
    r_multi = client.post("/api/upload", files=files)
    assert r_multi.status_code == 200
    data_multi = r_multi.json()
    assert data_multi["ok"] is True
    assert "upload_" in data_multi["id"]
    assert data_multi["url"].startswith("/images/uploads/")

    # 2. Test Base64 Upload
    r_b64 = client.post("/api/upload", json={"data": f"data:image/png;base64,{tiny_png_b64}", "filename": "b64.png"})
    assert r_b64.status_code == 200
    data_b64 = r_b64.json()
    assert data_b64["ok"] is True
    assert data_b64["url"].startswith("/images/uploads/")


def test_openai_images_edits(client):
    tiny_png_b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    tiny_png_bytes = base64.b64decode(tiny_png_b64)

    # Mock core.generate_image
    mock_core = MagicMock()
    mock_core.generate_image = AsyncMock(return_value={
        "path": "/home/ubuntu/.chatgpt-bridge/images/test_edited.png",
        "conversation_id": "conv-edit-123",
        "account_used": "acc-1",
    })

    with patch("chatgpt_bridge.daemon._get_core", return_value=mock_core):
        files = {"image": ("original.png", tiny_png_bytes, "image/png")}
        data = {"prompt": "Add a red hat", "response_format": "url"}
        resp = client.post("/v1/images/edits", files=files, data=data)
        assert resp.status_code == 200
        result = resp.json()
        assert "created" in result
        assert len(result["data"]) == 1
        assert "/images/test_edited.png" in result["data"][0]["url"]


def test_chat_completions_vision(client):
    tiny_png_b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    mock_core = MagicMock()
    mock_core.ask = AsyncMock(return_value={
        "response": "I see a 1x1 image.",
        "conversation_id": "conv-vision-456",
        "account_used": "acc-1",
    })

    with patch("chatgpt_bridge.daemon._get_core", return_value=mock_core):
        payload = {
            "model": "chatgpt",
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "Describe this image."},
                        {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{tiny_png_b64}"}},
                    ],
                }
            ],
        }
        resp = client.post("/v1/chat/completions", json=payload)
        assert resp.status_code == 200
        assert resp.json()["choices"][0]["message"]["content"] == "I see a 1x1 image."
        # Verify image_paths was passed to core.ask
        call_args = mock_core.ask.call_args
        assert call_args is not None
        assert "image_paths" in call_args.kwargs
        assert len(call_args.kwargs["image_paths"]) == 1


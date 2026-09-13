"""Smoke tests for the FastAPI daemon with a mocked core."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

import chatgpt_bridge.daemon as daemon
from chatgpt_bridge.errors import AuthError, GenerationDeniedError, ShapeChangedError


class _FakeCore:
    async def ask(self, prompt, model=None, conversation_id=None):
        return {"text": f"echo:{prompt}", "conversation_id": conversation_id or ""}

    async def generate_image(self, prompt, timeout_s=180):
        return {"path": "/tmp/x.png", "prompt": prompt}


class _FailingCore:
    async def ask(self, prompt, model=None, conversation_id=None):
        raise AuthError("no session")

    async def generate_image(self, prompt, timeout_s=180):
        raise ShapeChangedError("shape broke")


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(daemon, "_get_core", lambda: _FakeCore())
    return TestClient(daemon.app)


def test_health(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}


def test_ask_ok(client):
    resp = client.post("/ask", json={"prompt": "hi"})
    assert resp.status_code == 200
    assert resp.json() == {"text": "echo:hi", "conversation_id": ""}


def test_ask_with_conversation_id(client):
    resp = client.post("/ask", json={"prompt": "hi", "conversation_id": "c1"})
    assert resp.status_code == 200
    assert resp.json()["conversation_id"] == "c1"


def test_image_ok(client):
    resp = client.post("/image", json={"prompt": "a fox"})
    assert resp.status_code == 200
    assert resp.json() == {"path": "/tmp/x.png", "prompt": "a fox"}


def test_image_with_conversation_id_and_max_tries(monkeypatch):
    calls = []

    class _CaptureCore:
        async def generate_image(self, prompt, timeout_s=180, **kwargs):
            calls.append((prompt, timeout_s, kwargs))
            return {"path": "/tmp/x.png", "prompt": prompt, "conversation_id": kwargs.get("conversation_id")}

    monkeypatch.setattr(daemon, "_get_core", lambda: _CaptureCore())
    client = TestClient(daemon.app)
    resp = client.post("/image", json={"prompt": "a fox", "conversation_id": "c-123", "max_tries": 7})
    assert resp.status_code == 200
    assert resp.json()["conversation_id"] == "c-123"
    assert calls == [("a fox", 180, {"max_retries": 7, "conversation_id": "c-123"})]


def test_ask_error_maps_to_502(monkeypatch):
    monkeypatch.setattr(daemon, "_get_core", lambda: _FailingCore())
    client = TestClient(daemon.app)
    resp = client.post("/ask", json={"prompt": "hi"})
    assert resp.status_code == 502
    body = resp.json()
    assert body["error"]["type"] == "AuthError"
    assert "no session" in body["error"]["message"]


def test_image_denied_maps_to_502(monkeypatch):
    class _DeniedCore:
        async def generate_image(self, prompt, timeout_s=180):
            raise GenerationDeniedError("denied", kind="deterministic")

    monkeypatch.setattr(daemon, "_get_core", lambda: _DeniedCore())
    client = TestClient(daemon.app)
    resp = client.post("/image", json={"prompt": "a fox"})
    assert resp.status_code == 502
    body = resp.json()
    assert body["error"]["type"] == "GenerationDeniedError"
    assert "denied" in body["error"]["message"]


def test_write_daemon_json(tmp_path, monkeypatch):
    monkeypatch.setattr(daemon, "STATE_DIR", tmp_path)
    daemon.write_daemon_json()
    import json

    data = json.loads((tmp_path / "daemon.json").read_text())
    assert data["port"] == 8765
    assert data["pid"] > 0
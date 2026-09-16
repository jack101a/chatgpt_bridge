"""Smoke tests for the FastAPI daemon with a mocked core."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

import chatgpt_bridge.daemon as daemon
from chatgpt_bridge.errors import AuthError, GenerationDeniedError, ShapeChangedError


class _FakeCore:
    async def ask(self, prompt, model=None, conversation_id=None):
        return {"text": f"echo:{prompt}", "conversation_id": conversation_id or ""}

    async def generate_image(self, prompt, timeout_s=180, **kwargs):
        return {"path": "/tmp/x.png", "prompt": prompt}


class _FailingCore:
    async def ask(self, prompt, model=None, conversation_id=None):
        raise AuthError("no session")

    async def generate_image(self, prompt, timeout_s=180, **kwargs):
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
    data = resp.json()
    assert data["path"] == "/tmp/x.png"
    assert data["prompt"] == "a fox"
    assert data["image_url"] == "/images/x.png"
    assert data["thumbnail_url"] == "/thumbnails/x.webp"


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
    assert calls[0][0] == "a fox"
    assert calls[0][1] == 360
    assert calls[0][2]["max_retries"] == 7
    assert calls[0][2]["conversation_id"] == "c-123"


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
        async def generate_image(self, prompt, timeout_s=180, **kwargs):
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
    assert data["port"] == daemon.PORT
    assert data["pid"] > 0


def test_status_endpoint(monkeypatch):
    class _StatusCore:
        class _Session:
            async def is_alive(self):
                return True

        class _Pool:
            _ids = ["c1", "c2"]

        session = _Session()
        pool = _Pool()
        _started = True
        _current_conversation_id = "c2"
        max_retries = 4
        idle_timeout_s = 300

    monkeypatch.setattr(daemon, "_get_core", lambda: _StatusCore())
    client = TestClient(daemon.app)
    resp = client.get("/status")
    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is True
    assert data["authenticated"] is True
    assert data["browser_started"] is True
    assert data["chats_tracked"] == 2
    assert data["max_retries"] == 4


def test_reset_conversation(monkeypatch):
    reset_called = False

    class _ResetCore:
        def new_chat(self):
            nonlocal reset_called
            reset_called = True

    monkeypatch.setattr(daemon, "_get_core", lambda: _ResetCore())
    client = TestClient(daemon.app)
    resp = client.post("/conversations/new")
    assert resp.status_code == 200
    assert resp.json() == {"ok": True, "message": "Conversation thread reset"}
    assert reset_called is True


def test_get_image_endpoint(tmp_path, monkeypatch):
    test_img = tmp_path / "images" / "test1234.png"
    test_img.parent.mkdir(parents=True, exist_ok=True)
    test_img.write_bytes(b"\x89PNG\r\n\x1a\nfakeimage")

    monkeypatch.setattr(daemon, "IMAGES_DIR", tmp_path / "images")
    client = TestClient(daemon.app)
    resp = client.get("/images/test1234.png")
    assert resp.status_code == 200
    assert resp.content == b"\x89PNG\r\n\x1a\nfakeimage"


def test_list_and_switch_accounts_endpoints(monkeypatch):
    class _MockAccount:
        def __init__(self, aid, alias):
            self.id = aid
            self.alias = alias
            self.email = f"{alias.lower()}@test.com"
            self.is_authenticated = True
            self.total_generations = 5
            self.consecutive_rate_limits = 0
            self.rate_limited_until = None
            self.rate_limit_resets_at_str = ""

        def is_rate_limited(self):
            return False

    class _MockAccountManager:
        def __init__(self):
            self.active_account_id = "acc_1"
            self.accounts = {
                "acc_1": _MockAccount("acc_1", "Primary"),
                "acc_2": _MockAccount("acc_2", "Secondary"),
            }

    class _MockCore:
        def __init__(self):
            self.account_manager = _MockAccountManager()

        async def switch_account(self, account):
            if account in ("Secondary", "acc_2"):
                self.account_manager.active_account_id = "acc_2"
                return self.account_manager.accounts["acc_2"]
            raise KeyError(f"Account not found: {account}")

    core = _MockCore()
    monkeypatch.setattr(daemon, "_get_core", lambda: core)
    client = TestClient(daemon.app)

    # 1. GET /accounts
    resp = client.get("/accounts")
    assert resp.status_code == 200
    data = resp.json()
    assert data["active_account_id"] == "acc_1"
    assert len(data["accounts"]) == 2
    assert data["accounts"][0]["alias"] == "Primary"
    assert data["accounts"][0]["is_active"] is True

    # 2. POST /accounts/switch to Secondary
    switch_resp = client.post("/accounts/switch", json={"account": "Secondary"})
    assert switch_resp.status_code == 200
    assert switch_resp.json() == {"ok": True, "active_account": "Secondary", "account_id": "acc_2"}
    assert core.account_manager.active_account_id == "acc_2"

    # 3. POST /accounts/switch to invalid account
    fail_resp = client.post("/accounts/switch", json={"account": "NonExistent"})
    assert fail_resp.status_code == 404


    resp_404 = client.get("/images/nonexistent.png")
    assert resp_404.status_code == 404
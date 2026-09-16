import pytest
from starlette.testclient import TestClient
from chatgpt_bridge import daemon


def test_ask_with_new_conversation_resets(monkeypatch):
    reset_called = False

    class _MockCore:
        _current_conversation_id = "old_chat_123"

        def new_chat(self):
            nonlocal reset_called
            reset_called = True
            self._current_conversation_id = None

        async def ask(self, prompt, model=None, conversation_id=None):
            if conversation_id and conversation_id.strip().lower() in ("new", "clean"):
                self.new_chat()
                cid = None
            else:
                cid = conversation_id or self._current_conversation_id
            return {"text": f"echo:{prompt}", "conversation_id": cid}

    mock_core = _MockCore()
    monkeypatch.setattr(daemon, "_get_core", lambda: mock_core)
    client = TestClient(daemon.app)

    # 1. Ask with conversation_id="new"
    resp = client.post("/ask", json={"prompt": "hello", "conversation_id": "new"})
    assert resp.status_code == 200
    assert reset_called is True
    assert resp.json()["conversation_id"] is None
    assert mock_core._current_conversation_id is None


def test_image_with_new_conversation_resets(monkeypatch):
    reset_called = False
    passed_cid = None

    class _MockCore:
        _current_conversation_id = "prev_chat_456"

        def new_chat(self):
            nonlocal reset_called
            reset_called = True
            self._current_conversation_id = None

        async def generate_image(self, prompt, timeout_s=180, conversation_id=None, **kwargs):
            nonlocal passed_cid
            passed_cid = conversation_id
            if conversation_id and conversation_id.strip().lower() in ("new", "clean"):
                self.new_chat()
                cid = None
            else:
                cid = conversation_id or self._current_conversation_id
            return {"path": "/tmp/test.png", "prompt": prompt, "conversation_id": cid}

    mock_core = _MockCore()
    monkeypatch.setattr(daemon, "_get_core", lambda: mock_core)
    client = TestClient(daemon.app)

    # 1. Image with conversation_id="new"
    resp = client.post("/image", json={"prompt": "art portrait", "conversation_id": "new"})
    assert resp.status_code == 200
    assert reset_called is True
    assert passed_cid == "new"
    assert resp.json()["conversation_id"] is None
    assert mock_core._current_conversation_id is None


def test_get_image_without_extension(tmp_path, monkeypatch):
    images_dir = tmp_path / "images"
    images_dir.mkdir(parents=True, exist_ok=True)
    sample_png = images_dir / "1789501984885.png"
    sample_png.write_bytes(b"\x89PNG\r\n\x1a\nfakeimagecontent")

    monkeypatch.setattr(daemon, "IMAGES_DIR", images_dir)
    client = TestClient(daemon.app)

    # Request with bare ID (no extension)
    resp = client.get("/images/1789501984885")
    assert resp.status_code == 200
    assert resp.content == b"\x89PNG\r\n\x1a\nfakeimagecontent"

    # Request with .png extension
    resp2 = client.get("/images/1789501984885.png")
    assert resp2.status_code == 200
    assert resp2.content == b"\x89PNG\r\n\x1a\nfakeimagecontent"

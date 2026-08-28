"""Unit tests for the backend HTTP client using canned SSE via MockTransport."""

from __future__ import annotations

import asyncio
import json

import httpx
import pytest

from chatgpt_bridge.errors import ShapeChangedError
from chatgpt_bridge.http_client import BackendClient, _parse_sse


class _FakeSession:
    async def get_access_token(self) -> str:
        return "test-token"

    async def get_cookies(self) -> list[dict]:
        return [{"name": "a", "value": "b"}]


def _sse_line(obj: dict) -> str:
    return "data: " + json.dumps(obj) + "\n"


def _finished_message(text: str, conversation_id: str = "conv-1") -> str:
    return _sse_line(
        {
            "message": {
                "status": "finished_successfully",
                "content": {"content_type": "text", "parts": [text]},
            },
            "conversation_id": conversation_id,
        }
    )


def test_parse_sse_valid():
    blob = (
        _sse_line({"message": {"status": "in_progress"}})
        + _finished_message("Hello there")
    )
    result = _parse_sse(blob)
    assert result["text"] == "Hello there"
    assert result["conversation_id"] == "conv-1"


def test_parse_sse_truncated_raises():
    blob = _sse_line({"message": {"status": "in_progress"}})
    with pytest.raises(ShapeChangedError):
        _parse_sse(blob)


def test_parse_sse_error_json_raises():
    blob = "data: not-json\n"
    with pytest.raises(ShapeChangedError):
        _parse_sse(blob)


def test_parse_sse_empty_parts_raises():
    blob = _sse_line(
        {"message": {"status": "finished_successfully", "content": {"parts": []}}}
    )
    with pytest.raises(ShapeChangedError):
        _parse_sse(blob)


def _make_client(handler):
    transport = httpx.MockTransport(handler)
    return BackendClient(_FakeSession(), transport=transport)


def test_ask_returns_text_and_conversation_id():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["authorization"] == "Bearer test-token"
        body = json.loads(request.content)
        assert body["action"] == "next"
        assert body["messages"][0]["content"]["parts"] == ["hi"]
        return httpx.Response(
            200,
            text=_finished_message("answer", "conv-9"),
        )

    client = _make_client(handler)
    result = asyncio.run(client.ask("hi"))
    assert result["text"] == "answer"
    assert result["conversation_id"] == "conv-9"


def test_ask_non_200_raises_shape_changed():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, text="boom")

    client = _make_client(handler)
    with pytest.raises(ShapeChangedError):
        asyncio.run(client.ask("hi"))


def test_ask_truncated_sse_raises_shape_changed():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, text=_sse_line({"message": {"status": "in_progress"}}))

    client = _make_client(handler)
    with pytest.raises(ShapeChangedError):
        asyncio.run(client.ask("hi"))
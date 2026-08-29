"""Unit tests for chat pool management (bounded conversation history)."""

from __future__ import annotations

import asyncio
import json

import httpx
import pytest

from chatgpt_bridge.chat_pool import ChatPoolManager


class _FakeSession:
    def __init__(self) -> None:
        self.deleted: list[str] = []

    async def get_access_token(self) -> str:
        return "test-token"

    async def get_cookies(self) -> list[dict]:
        return [{"name": "a", "value": "b"}]

    async def delete_conversation(self, conversation_id: str) -> None:
        self.deleted.append(conversation_id)


def _make_pool(tmp_path, max_chats: int = 10, session=None):
    session = session or _FakeSession()
    pool = ChatPoolManager(
        session=session,
        state_path=tmp_path / "chat_pool.json",
        max_chats=max_chats,
    )
    return pool, session


def test_record_adds_id_in_order():
    pool, _ = _make_pool(pytest.importorskip("pathlib").Path("/tmp/x"), max_chats=10)
    pool.record("conv-1")
    pool.record("conv-2")
    assert pool._ids == ["conv-1", "conv-2"]


def test_record_deduplicates_existing_id():
    pool, _ = _make_pool(pytest.importorskip("pathlib").Path("/tmp/x"), max_chats=10)
    pool.record("conv-1")
    pool.record("conv-2")
    pool.record("conv-1")
    assert pool._ids == ["conv-2", "conv-1"]


def test_prune_deletes_oldest_when_over_limit(tmp_path):
    pool, session = _make_pool(tmp_path, max_chats=3)
    for i in range(5):
        pool.record(f"conv-{i}")
    # oldest two (conv-0, conv-1) should be deleted, leaving conv-2..conv-4
    deleted = asyncio.run(pool.prune())
    assert deleted == ["conv-0", "conv-1"]
    assert pool._ids == ["conv-2", "conv-3", "conv-4"]


def test_prune_noop_when_under_limit(tmp_path):
    pool, session = _make_pool(tmp_path, max_chats=10)
    pool.record("conv-1")
    deleted = asyncio.run(pool.prune())
    assert deleted == []
    assert pool._ids == ["conv-1"]


def test_prune_persists_state(tmp_path):
    pool, _ = _make_pool(tmp_path, max_chats=3)
    for i in range(5):
        pool.record(f"conv-{i}")
    asyncio.run(pool.prune())
    # reload from disk
    pool2, _ = _make_pool(tmp_path, max_chats=3)
    assert pool2._ids == ["conv-2", "conv-3", "conv-4"]


def test_prune_uses_backend_delete(tmp_path):
    session = _FakeSession()
    pool, _ = _make_pool(tmp_path, max_chats=2, session=session)
    for i in range(4):
        pool.record(f"conv-{i}")
    asyncio.run(pool.prune())
    assert session.deleted == ["conv-0", "conv-1"]
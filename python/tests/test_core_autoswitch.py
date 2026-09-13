"""Unit tests for Core Engine auto-account switching."""

from __future__ import annotations

import asyncio
from pathlib import Path

import pytest

from chatgpt_bridge.account import AccountInfo, AccountManager
from chatgpt_bridge.core import ChatGPT
from chatgpt_bridge.errors import GenerationDeniedError


class _MockUI:
    def __init__(self, outcomes: dict[str, list]):
        # outcomes maps account alias to list of outcomes (either dict or Exception)
        self.outcomes = outcomes
        self.calls = []

    async def generate_image(self, prompt, **kwargs):
        acc_alias = getattr(self, "current_alias", "unknown")
        self.calls.append((acc_alias, prompt, kwargs.get("conversation_id")))
        queue = self.outcomes.get(acc_alias, [])
        if not queue:
            return {"path": f"/tmp/{acc_alias}.png", "conversation_id": f"cid-{acc_alias}"}
        item = queue.pop(0)
        if isinstance(item, Exception):
            raise item
        return item

    async def ask(self, prompt, **kwargs):
        acc_alias = getattr(self, "current_alias", "unknown")
        self.calls.append((acc_alias, prompt, kwargs.get("conversation_id")))
        queue = self.outcomes.get(acc_alias, [])
        if not queue:
            return {"text": f"Answer from {acc_alias}", "conversation_id": f"cid-{acc_alias}"}
        item = queue.pop(0)
        if isinstance(item, Exception):
            raise item
        return item


def _setup_test_manager(tmp_path: Path) -> AccountManager:
    mgr = AccountManager(state_dir=tmp_path)
    # Configure 2 authenticated accounts
    acc1 = mgr.accounts["default"]
    acc1.alias = "Primary"
    acc1.email = "primary@test.com"
    acc1.is_authenticated = True

    acc2 = mgr.add_account(alias="Secondary", account_id="acc_secondary")
    acc2.email = "secondary@test.com"
    acc2.is_authenticated = True
    mgr._save()
    return mgr


def test_proactive_auto_switch_on_rate_limited_account(tmp_path):
    mgr = _setup_test_manager(tmp_path)
    primary = mgr.find_account("Primary")
    # Mark Primary as rate limited until future
    mgr.record_rate_limit(primary.id, wait_seconds=3600, resets_at_str="in 1 hour")

    gpt = ChatGPT(account_manager=mgr, auto_switch=True, use_http=False)
    gpt._started = True

    mock_ui = _MockUI(
        {"Secondary": [{"path": "/tmp/secondary.png", "conversation_id": "cid-sec"}]}
    )
    gpt.ui = mock_ui

    async def mock_switch(acc_id):
        acc = mgr.set_active_account(acc_id)
        mock_ui.current_alias = acc.alias
        return acc

    gpt.switch_account = mock_switch
    mock_ui.current_alias = primary.alias

    res = asyncio.run(gpt.generate_image("draw an apple"))

    assert res["account_used"] == "Secondary"
    assert res["switched_from"] == "Primary"
    assert mgr.active_account_id == "acc_secondary"


def test_reactive_auto_switch_on_rate_limit_denial(tmp_path):
    mgr = _setup_test_manager(tmp_path)
    gpt = ChatGPT(account_manager=mgr, auto_switch=True, use_http=False)
    gpt._started = True

    mock_ui = _MockUI(
        {
            "Primary": [
                GenerationDeniedError(
                    "You've reached your image limit. Try again in 2 hours.",
                    kind="rate_limit",
                )
            ],
            "Secondary": [
                {"path": "/tmp/recovered.png", "conversation_id": "cid-new"}
            ],
        }
    )
    gpt.ui = mock_ui

    async def mock_switch(acc_id):
        acc = mgr.set_active_account(acc_id)
        mock_ui.current_alias = acc.alias
        return acc

    gpt.switch_account = mock_switch
    mock_ui.current_alias = "Primary"

    res = asyncio.run(gpt.generate_image("draw a castle"))

    assert res["path"] == "/tmp/recovered.png"
    assert res["account_used"] == "Secondary"
    assert res["switched_from"] == "Primary"
    assert mgr.active_account_id == "acc_secondary"

    # Verify Primary now has rate limit registered
    prim = mgr.find_account("Primary")
    assert prim.is_rate_limited()
    assert prim.consecutive_rate_limits == 1


def test_reactive_auto_switch_exhausted(tmp_path):
    mgr = _setup_test_manager(tmp_path)
    # Pre-rate limit Secondary
    sec = mgr.find_account("Secondary")
    mgr.record_rate_limit(sec.id, wait_seconds=3600)

    gpt = ChatGPT(account_manager=mgr, auto_switch=True, use_http=False)
    gpt._started = True

    mock_ui = _MockUI(
        {
            "Primary": [
                GenerationDeniedError(
                    "Too many requests. Try again in 30 minutes.",
                    kind="rate_limit",
                )
            ]
        }
    )
    gpt.ui = mock_ui
    mock_ui.current_alias = "Primary"

    with pytest.raises(GenerationDeniedError) as exc_info:
        asyncio.run(gpt.generate_image("draw a galaxy"))

    assert exc_info.value.kind == "rate_limit"
    assert "Too many requests" in str(exc_info.value)


def test_reactive_auto_switch_ask(tmp_path):
    mgr = _setup_test_manager(tmp_path)
    gpt = ChatGPT(account_manager=mgr, auto_switch=True, use_http=False)
    gpt._started = True

    mock_ui = _MockUI(
        {
            "Primary": [
                GenerationDeniedError(
                    "Too many requests in dialog",
                    kind="rate_limit",
                )
            ],
            "Secondary": [
                {"text": "Hello from Secondary!", "conversation_id": "cid-ask-sec"}
            ],
        }
    )
    gpt.ui = mock_ui

    async def mock_switch(acc_id):
        acc = mgr.set_active_account(acc_id)
        mock_ui.current_alias = acc.alias
        return acc

    gpt.switch_account = mock_switch
    mock_ui.current_alias = "Primary"

    res = asyncio.run(gpt.ask("What is quantum computing?"))

    assert res["text"] == "Hello from Secondary!"
    assert res["account_used"] == "Secondary"
    assert res["switched_from"] == "Primary"
    assert mgr.active_account_id == "acc_secondary"


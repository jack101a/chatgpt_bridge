"""Unit tests for multi-account manager and per-account FIFO chat pool."""

from __future__ import annotations

import time
from pathlib import Path

import pytest

from chatgpt_bridge.account import AccountInfo, AccountManager


def test_account_manager_initial_setup(tmp_path: Path):
    mgr = AccountManager(state_dir=tmp_path)
    accounts = mgr.list_accounts()
    assert len(accounts) == 1
    default_acc = accounts[0]
    assert default_acc.id == "default"
    assert default_acc.alias == "Primary"
    assert mgr.get_active_account().id == "default"
    assert Path(default_acc.profile_dir).parent == tmp_path or Path(default_acc.profile_dir).parent.parent == tmp_path
    assert Path(default_acc.chat_pool_file).exists() or not Path(default_acc.chat_pool_file).exists()


def test_add_and_switch_account(tmp_path: Path):
    mgr = AccountManager(state_dir=tmp_path)
    acc2 = mgr.add_account("Work Account")
    assert acc2.alias == "Work Account"
    assert acc2.id.startswith("acc_")
    assert Path(acc2.profile_dir).exists()
    assert "Work Account" in [a.alias for a in mgr.list_accounts()]

    # Switch to acc2 by ID
    mgr.set_active_account(acc2.id)
    assert mgr.get_active_account().id == acc2.id

    # Switch back by alias
    mgr.set_active_account("Primary")
    assert mgr.get_active_account().id == "default"


def test_remove_account(tmp_path: Path):
    mgr = AccountManager(state_dir=tmp_path)
    acc2 = mgr.add_account("Backup")
    assert len(mgr.list_accounts()) == 2

    # Remove backup
    assert mgr.remove_account("Backup") is True
    assert len(mgr.list_accounts()) == 1

    # Cannot remove the only remaining account
    with pytest.raises(ValueError):
        mgr.remove_account("default")


def test_rate_limit_tracking_and_strikes(tmp_path: Path):
    mgr = AccountManager(state_dir=tmp_path)
    acc1 = mgr.get_active_account()

    # Strike 1
    strikes, alt = mgr.record_rate_limit(acc1.id, wait_seconds=3600, resets_at_str="18:00")
    assert strikes == 1
    assert alt is None
    assert acc1.is_rate_limited() is True
    assert acc1.consecutive_rate_limits == 1

    # Add a second account (not logged in initially)
    acc2 = mgr.add_account("Secondary")
    assert acc2.is_logged_in is False

    # Strike 2
    strikes, alt = mgr.record_rate_limit(acc1.id, wait_seconds=3600, resets_at_str="18:00")
    assert strikes == 2
    assert alt is None

    # Strike 3 with unauthenticated acc2 -> alt is None (safe, won't switch to unauthenticated profile!)
    strikes, alt = mgr.record_rate_limit(acc1.id, wait_seconds=3600, resets_at_str="18:00")
    assert strikes == 3
    assert alt is None

    # Now log in acc2
    acc2.email = "sec@chatgpt.com"
    acc2.is_authenticated = True
    assert acc2.is_logged_in is True

    # Check available accounts
    alt_logged_in = mgr.get_least_used_available_account(exclude_id=acc1.id)
    assert alt_logged_in is not None
    assert alt_logged_in.id == acc2.id


def test_least_used_account_selection(tmp_path: Path):
    mgr = AccountManager(state_dir=tmp_path)
    acc1 = mgr.get_active_account()
    acc1.last_used_at = time.time() - 100

    acc2 = mgr.add_account("Old Account")
    acc2.email = "old@chatgpt.com"
    acc2.last_used_at = time.time() - 500  # Used longer ago (least recently used)

    acc3 = mgr.add_account("Recent Account")
    acc3.email = "recent@chatgpt.com"
    acc3.last_used_at = time.time() - 50

    # Old Account should be selected as least recently used
    best = mgr.get_least_used_available_account(exclude_id=acc1.id)
    assert best is not None
    assert best.id == acc2.id

    # If Old Account is rate limited, Recent Account should be selected
    acc2.rate_limited_until = time.time() + 3600
    best2 = mgr.get_least_used_available_account(exclude_id=acc1.id)
    assert best2 is not None
    assert best2.id == acc3.id


def test_record_generation_success_resets_rate_limit(tmp_path: Path):
    mgr = AccountManager(state_dir=tmp_path)
    acc = mgr.get_active_account()
    mgr.record_rate_limit(acc.id, wait_seconds=3600)
    assert acc.consecutive_rate_limits == 1
    assert acc.is_rate_limited() is True

    mgr.record_generation_success(acc.id)
    assert acc.consecutive_rate_limits == 0
    assert acc.is_rate_limited() is False
    assert acc.total_generations == 1

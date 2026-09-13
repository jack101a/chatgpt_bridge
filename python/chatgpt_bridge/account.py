"""Multi-account manager for chatgpt-bridge.

Manages multiple independent browser profiles, per-account FIFO chat pools,
session identity tracking, rate-limit state persistence, and LRU account rotation.
"""

from __future__ import annotations

import json
import logging
import os
import time
from dataclasses import asdict, dataclass, field, fields
from pathlib import Path
from typing import Any

log = logging.getLogger("chatgpt_bridge.account")

STATE_DIR = Path(os.environ.get("CHATGPT_BRIDGE_STATE", "~/.chatgpt-bridge")).expanduser()
ACCOUNTS_REGISTRY = STATE_DIR / "accounts.json"
ACCOUNTS_ROOT = STATE_DIR / "accounts"


@dataclass
class AccountInfo:
    id: str
    alias: str
    email: str = ""
    name: str = ""
    profile_dir: str = ""
    chat_pool_file: str = ""
    cookies_file: str = ""
    is_authenticated: bool = False
    created_at: float = field(default_factory=time.time)
    last_used_at: float = 0.0
    total_generations: int = 0
    consecutive_rate_limits: int = 0
    rate_limited_until: float | None = None
    rate_limit_resets_at_str: str = ""

    @property
    def is_logged_in(self) -> bool:
        """True if the account is verified to have an authenticated ChatGPT session."""
        if self.is_authenticated or bool(self.email):
            return True
        if self.cookies_file and Path(self.cookies_file).exists():
            return True
        return False

    def is_rate_limited(self, now: float | None = None) -> bool:
        t = now if now is not None else time.time()
        return bool(self.rate_limited_until and self.rate_limited_until > t)

    def remaining_rate_limit_seconds(self, now: float | None = None) -> float:
        t = now if now is not None else time.time()
        if not self.rate_limited_until or self.rate_limited_until <= t:
            return 0.0
        return self.rate_limited_until - t


class AccountManager:
    """Registry and lifecycle manager for ChatGPT bridge accounts."""

    def __init__(self, state_dir: Path | str = STATE_DIR) -> None:
        self.state_dir = Path(state_dir)
        self.registry_file = self.state_dir / "accounts.json"
        self.accounts_root = self.state_dir / "accounts"
        self.accounts: dict[str, AccountInfo] = {}
        self.active_account_id: str = "default"
        self._load()

    def _load(self) -> None:
        self.state_dir.mkdir(parents=True, exist_ok=True)
        self.accounts_root.mkdir(parents=True, exist_ok=True)

        if self.registry_file.exists():
            try:
                data = json.loads(self.registry_file.read_text(encoding="utf-8"))
                self.active_account_id = data.get("active_account_id", "default")
                valid_fields = {f.name for f in fields(AccountInfo)}
                for acc_id, acc_data in data.get("accounts", {}).items():
                    filtered = {k: v for k, v in acc_data.items() if k in valid_fields}
                    acc = AccountInfo(**filtered)
                    # Always rebase paths relative to current state_dir for host/container portability
                    if acc.id == "default":
                        acc.profile_dir = str(self.state_dir / "profile")
                        acc.chat_pool_file = str(self.state_dir / "chat_pool.json")
                        acc.cookies_file = str(self.state_dir / "cookies.json")
                    else:
                        acc.profile_dir = str(self.accounts_root / acc.id / "profile")
                        acc.chat_pool_file = str(self.accounts_root / acc.id / "chat_pool.json")
                        acc.cookies_file = str(self.accounts_root / acc.id / "cookies.json")
                    if acc.email:
                        acc.is_authenticated = True
                    self.accounts[acc_id] = acc
                if self.accounts and self.active_account_id not in self.accounts:
                    self.active_account_id = next(iter(self.accounts))
                return
            except Exception as exc:
                log.warning("failed to load accounts registry: %s — recreating default", exc)

        # Migration / Initial default setup
        default_profile = self.state_dir / "profile"
        default_pool = self.state_dir / "chat_pool.json"
        default_cookies = self.state_dir / "cookies.json"
        acc_default = AccountInfo(
            id="default",
            alias="Primary",
            profile_dir=str(default_profile),
            chat_pool_file=str(default_pool),
            cookies_file=str(default_cookies),
            is_authenticated=default_cookies.exists(),
            created_at=time.time(),
            last_used_at=time.time(),
        )
        self.accounts = {"default": acc_default}
        self.active_account_id = "default"
        self._save()

    def _save(self) -> None:
        data = {
            "active_account_id": self.active_account_id,
            "accounts": {acc_id: asdict(acc) for acc_id, acc in self.accounts.items()},
        }
        self.registry_file.write_text(json.dumps(data, indent=2), encoding="utf-8")

    def list_accounts(self) -> list[AccountInfo]:
        """Return all registered accounts."""
        return list(self.accounts.values())

    def get_active_account(self) -> AccountInfo:
        """Return the currently active account."""
        if self.active_account_id not in self.accounts:
            if self.accounts:
                self.active_account_id = next(iter(self.accounts))
            else:
                self.add_account("Primary", account_id="default")
        return self.accounts[self.active_account_id]

    def find_account(self, id_or_alias: str) -> AccountInfo | None:
        """Find an account by ID or case-insensitive alias."""
        target = id_or_alias.strip().lower()
        for acc in self.accounts.values():
            if acc.id.lower() == target or acc.alias.lower() == target:
                return acc
        return None

    def set_active_account(self, id_or_alias: str) -> AccountInfo:
        """Switch the active account to the specified ID or alias."""
        acc = self.find_account(id_or_alias)
        if not acc:
            raise KeyError(f"Account not found: {id_or_alias}")
        self.active_account_id = acc.id
        self._save()
        return acc

    def add_account(self, alias: str, account_id: str | None = None) -> AccountInfo:
        """Create and register a new account slot with isolated profile and chat pool."""
        alias = alias.strip()
        if not alias:
            raise ValueError("Account alias cannot be empty")
        acc_id = account_id or f"acc_{int(time.time())}"
        acc_dir = self.accounts_root / acc_id
        profile_dir = acc_dir / "profile"
        pool_file = acc_dir / "chat_pool.json"
        cookies_file = acc_dir / "cookies.json"
        profile_dir.mkdir(parents=True, exist_ok=True)

        acc = AccountInfo(
            id=acc_id,
            alias=alias,
            profile_dir=str(profile_dir),
            chat_pool_file=str(pool_file),
            cookies_file=str(cookies_file),
            is_authenticated=False,
            created_at=time.time(),
        )
        self.accounts[acc_id] = acc
        self._save()
        return acc

    def remove_account(self, id_or_alias: str) -> bool:
        """Remove an account by ID or alias. Refuses to delete the last remaining account."""
        if len(self.accounts) <= 1:
            raise ValueError("Cannot delete the only remaining account")
        acc = self.find_account(id_or_alias)
        if not acc:
            return False
        acc_dir = self.accounts_root / acc.id
        if acc_dir.exists():
            import shutil
            shutil.rmtree(acc_dir, ignore_errors=True)
        del self.accounts[acc.id]
        if self.active_account_id == acc.id:
            self.active_account_id = next(iter(self.accounts))
        self._save()
        return True

    def update_identity(self, account_id: str, email: str = "", name: str = "") -> None:
        """Update harvested user email and name for the account."""
        acc = self.accounts.get(account_id)
        if not acc:
            return
        updated = False
        if email and acc.email != email:
            acc.email = email
            acc.is_authenticated = True
            updated = True
        if name and acc.name != name:
            acc.name = name
            updated = True
        if updated:
            self._save()

    def record_generation_success(self, account_id: str) -> None:
        """Record successful image generation, resetting rate limit strikes."""
        acc = self.accounts.get(account_id)
        if not acc:
            return
        acc.last_used_at = time.time()
        acc.total_generations += 1
        acc.consecutive_rate_limits = 0
        acc.rate_limited_until = None
        acc.rate_limit_resets_at_str = ""
        self._save()

    def record_rate_limit(
        self, account_id: str, wait_seconds: float, resets_at_str: str = ""
    ) -> tuple[int, AccountInfo | None]:
        """Record a rate limit occurrence.

        Returns (consecutive_rate_limits, least_used_alternative_account).
        If consecutive_rate_limits >= 3, attempts to identify the least-used available alternative account.
        """
        acc = self.accounts.get(account_id)
        if not acc:
            return (1, None)
        acc.consecutive_rate_limits += 1
        now = time.time()
        acc.rate_limited_until = now + wait_seconds
        acc.rate_limit_resets_at_str = resets_at_str
        self._save()

        alt_account = None
        if acc.consecutive_rate_limits >= 3:
            alt_account = self.get_least_used_available_account(exclude_id=account_id)
        return (acc.consecutive_rate_limits, alt_account)

    def get_least_used_available_account(
        self, exclude_id: str | None = None
    ) -> AccountInfo | None:
        """Return the least recently used account that is authenticated and not currently rate-limited."""
        now = time.time()
        available = [
            acc
            for acc in self.accounts.values()
            if acc.is_logged_in
            and (exclude_id is None or acc.id != exclude_id)
            and not acc.is_rate_limited(now)
        ]
        if not available:
            return None
        # Sort by total_generations first, then last_used_at ascending (LRU)
        available.sort(key=lambda a: (a.total_generations, a.last_used_at))
        return available[0]

"""CLI tool to log in to ChatGPT accounts (interactive browser or cookies import)."""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import sys
from pathlib import Path

from .account import AccountManager
from .browser import BrowserManager
from .cookies import cookies_valid, load_cookie_file, parse_cookie_text
from .session import SessionManager

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("chatgpt_bridge.login")


async def login_via_cookies(
    acc_id: str, cookie_source: str, mgr: AccountManager | None = None
) -> None:
    mgr = mgr or AccountManager()
    acc = mgr.find_account(acc_id)
    if not acc:
        log.error("Account not found: %s", acc_id)
        sys.exit(1)

    p = Path(cookie_source)
    if p.exists():
        cookies = load_cookie_file(p)
    else:
        cookies = parse_cookie_text(cookie_source)

    if not cookies_valid(cookies):
        log.error("Provided cookies do not contain a valid ChatGPT session-token")
        sys.exit(1)

    log.info("Saving cookies to account '%s'...", acc.alias)
    cookie_file = Path(acc.cookies_file or (mgr.accounts_root / acc.id / "cookies.json"))
    cookie_file.parent.mkdir(parents=True, exist_ok=True)
    cookie_file.write_text(json.dumps(cookies, indent=2), encoding="utf-8")
    acc.cookies_file = str(cookie_file)

    log.info("Verifying session against chatgpt.com/api/auth/session...")
    bm = BrowserManager(headless=True, profile_dir=acc.profile_dir)
    try:
        ctx = await bm.context()
        await ctx.add_cookies(cookies)
        sm = SessionManager(bm)
        alive = await sm.is_alive()
        if not alive:
            log.error("Session verification failed: cookies rejected by ChatGPT")
            sys.exit(1)
        info = await sm.get_user_info()
        email = info.get("email", "")
        name = info.get("name", "")
        mgr.update_identity(acc.id, email=email, name=name)
        acc.is_authenticated = True
        mgr._save()
        log.info("Successfully authenticated account '%s'! User: %s (%s)", acc.alias, name, email)
    finally:
        await bm.stop()


async def login_interactive(acc_id: str, mgr: AccountManager | None = None) -> None:
    mgr = mgr or AccountManager()
    acc = mgr.find_account(acc_id)
    if not acc:
        log.error("Account not found: %s", acc_id)
        sys.exit(1)

    log.info("Opening browser window for account '%s' (%s)...", acc.alias, acc.profile_dir)
    log.info("Please log in to your ChatGPT account in the browser window.")
    bm = BrowserManager(headless=False, profile_dir=acc.profile_dir)
    try:
        ctx = await bm.context()
        page = await ctx.new_page()
        await page.goto("https://chatgpt.com/", wait_until="domcontentloaded")
        sm = SessionManager(bm)

        log.info("Waiting for authenticated session...")
        for _ in range(120):  # wait up to 10 minutes
            await asyncio.sleep(5)
            try:
                if await sm.is_alive():
                    info = await sm.get_user_info()
                    email = info.get("email", "")
                    name = info.get("name", "")
                    cookies = await ctx.cookies()
                    cookie_file = Path(
                        acc.cookies_file or (mgr.accounts_root / acc.id / "cookies.json")
                    )
                    cookie_file.parent.mkdir(parents=True, exist_ok=True)
                    cookie_file.write_text(json.dumps(cookies, indent=2), encoding="utf-8")
                    acc.cookies_file = str(cookie_file)
                    mgr.update_identity(acc.id, email=email, name=name)
                    acc.is_authenticated = True
                    mgr._save()
                    log.info(
                        "🎉 Login detected! Account '%s' authenticated as %s (%s)",
                        acc.alias,
                        name,
                        email,
                    )
                    return
            except Exception:
                pass
        log.error("Timed out waiting for login.")
        sys.exit(1)
    finally:
        await bm.stop()


def main() -> None:
    parser = argparse.ArgumentParser(description="Log in to a ChatGPT account")
    parser.add_argument(
        "--account", "-a", help="Account alias or ID (default: active account)", default=None
    )
    parser.add_argument(
        "--cookies", "-c", help="Path to cookie file or raw cookie string", default=None
    )
    parser.add_argument(
        "--interactive",
        "-i",
        action="store_true",
        help="Launch headful browser for interactive login",
    )
    parser.add_argument(
        "--list", "-l", action="store_true", help="List accounts and their login status"
    )
    args = parser.parse_args()

    mgr = AccountManager()
    if args.list:
        print("\nRegistered ChatGPT Accounts:")
        for acc in mgr.list_accounts():
            status = "🟢 Logged In" if acc.is_logged_in else "⚠️ Not Logged In"
            active_mark = " (ACTIVE)" if acc.id == mgr.active_account_id else ""
            print(f"  • [{acc.id}] {acc.alias} - {acc.email or 'no email'} | {status}{active_mark}")
        print()
        return

    target_id = args.account or mgr.active_account_id
    if args.cookies:
        asyncio.run(login_via_cookies(target_id, args.cookies, mgr=mgr))
    elif args.interactive:
        asyncio.run(login_interactive(target_id, mgr=mgr))
    else:
        print(f"Target account: {target_id}")
        print("Choose login method:")
        print("  1. Import cookie file (cookies.json / cookies.txt)")
        print("  2. Interactive browser login")
        try:
            choice = input("Enter choice (1/2): ").strip()
        except EOFError:
            print("No interactive input available.")
            return
        if choice == "1":
            path = input("Enter path to cookie file: ").strip()
            asyncio.run(login_via_cookies(target_id, path, mgr=mgr))
        elif choice == "2":
            asyncio.run(login_interactive(target_id, mgr=mgr))
        else:
            print("Cancelled.")


if __name__ == "__main__":
    main()

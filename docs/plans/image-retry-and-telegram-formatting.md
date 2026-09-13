# Plan: Image Retry Optimization & Telegram Rich Formatting

## Goal
Enhance the bridge and Telegram bot to provide maximum text formatting (Markdown to native Telegram HTML), persistent same-conversation image retries up to a configurable ceiling (default 10) with in-place 'Try again' clicks, and fix cookie parsing for `#HttpOnly_`.

## Tasks
- [x] Task 1: Fix Netscape cookie parser in `cookies.py` to preserve `#HttpOnly_` lines and cookies → Verify with `pytest tests/test_cookies.py`
- [x] Task 2: Implement persistent same-conversation image retry in `ui_driver.py` and wire `max_tries` in `core.py` and `daemon.py` → Verify with `pytest tests/test_ui_retry.py tests/test_daemon.py`
- [x] Task 3: Implement rich Markdown-to-Telegram-HTML conversion and safe entity/tag chunking in `bot.py` → Verify with unit tests in `tests/test_bot.py`
- [x] Task 4: Add typing/upload_photo heartbeat and enforce silent ignore for non-whitelisted users in `bot.py` → Verify with `tests/test_bot.py`
- [x] Task 5: Run full test suite and live end-to-end verification of text formatting and image retry → Verify: all unit tests pass and live bridge execution succeeds

## Done When
- All unit tests pass (`pytest`).
- Telegram bot formats ChatGPT Markdown responses with HTML tags (`<pre><code>`, `<b>`, `<i>`, etc.).
- Image generation retries in the same conversation without altering prompts, reloading pages, or dropping after 3 tries.
- `#HttpOnly_` Netscape cookies are imported correctly without dropping the session token.

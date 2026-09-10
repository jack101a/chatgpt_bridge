# Telegram Bot for chatgpt-bridge — Design

> Date: 2026-09-10. Approved by user via brainstorming dialogue.

## Goal

Manage the whole chatgpt-bridge from a Telegram chat: text answers, image
generation, session status, and chat-pool management.

## Architecture

- Standalone process, long polling (no public URL/TLS needed):
  `python -m chatgpt_bridge.bot`
- Transport: plain `httpx` long polling against the Bot API (already a
  project dependency; no new deps). `getUpdates` with `timeout=50`
  (long poll) + `allowed_updates=["message"]`; errors logged and retried with
  a short sleep. (python-telegram-bot was preferred but PyPI is unreachable
  from the build box; the Bot API surface used here is tiny and stable.)
- The bot owns an in-process `chatgpt_bridge.ChatGPT` instance (owns the
  Chromium profile). **Mutual exclusion:** run the bot OR the HTTP daemon, not
  both concurrently (both use `~/.chatgpt-bridge/profile`).
- All bot commands serialized through one `asyncio.Lock` so concurrent
  Telegram requests cannot interleave browser operations.

## Config (env)

- `TELEGRAM_BOT_TOKEN` (required; from @BotFather) — missing/empty → clear
  startup error.
- `TELEGRAM_ALLOWED_USER_IDS` — comma-separated numeric Telegram user IDs.
  Missing/empty → **deny all** (fail closed). Non-listed users are silently
  ignored (no reply, no logging of message content).

## Commands

| Input                     | Action                                                        |
|---------------------------|---------------------------------------------------------------|
| any plain text            | `ask()` → reply text (typing action while working)            |
| `/image <prompt>`         | `generate_image()` → reply with PNG as photo                  |
| `/status`                 | session alive, browser running, pool size/max, pool file path |
| `/chats`                  | list tracked chat ids in pool (oldest → newest)               |
| `/clear`                  | soft-delete ALL tracked chats, reset pool file                |
| `/start`, `/help`         | usage summary                                                 |

Conversation image with no prompt → usage hint.

## Behavior details

- Pure bridge: prompts are forwarded verbatim; retry behavior comes from the
  existing core (`max_retries`, retry loop, `GenerationDeniedError`).
- Lazy browser start: bot process boots fast; `_ensure_started` happens on
  first real command (existing core behavior).
- Pool state is read from `ChatGPT.pool` (live object + persisted json).
- `/clear` iterates pool ids, calls `session.delete_conversation`,
  empties pool (best-effort per id; reports count deleted/failed).

## Error surfacing (plain English replies)

| Condition              | Reply                                                  |
|------------------------|--------------------------------------------------------|
| `GenerationDeniedError`| `denied: <kind> — see https://... (no)` → `generation denied (<kind>). Try rewording.` |
| `BridgeTimeoutError`   | `timed out — try a shorter prompt or retry.`           |
| `AuthError`            | `session expired — refresh ~/.chatgpt-bridge/cookies.txt` |
| Daemon/misc exception  | `error: <type>` (no stack traces to Telegram)          |

Long answers (>4096 chars Telegram limit) are split into sequential messages.

## Non-goals (YAGNI)

- Webhook mode, groups/forum support, inline queries, streaming edits,
  multi-account, per-user state isolation, image reference upload.

## Files

- `python/chatgpt_bridge/bot.py` — handlers + `main()`
- `python/tests/test_bot.py` — unit tests with fake Update/core objects
- `README.md` — bot section (setup with @BotFather, env vars, commands)

(No pyproject change — httpx is already a dependency.)

## Testing

Unit tests mock Update/Context and a fake core object; cover whitelist
behavior, each command, error mapping, >4096 splitting. Real Telegram
interaction verified manually with a bot token.

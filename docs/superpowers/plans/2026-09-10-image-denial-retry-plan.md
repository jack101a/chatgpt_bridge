# Image Denial Auto-Retry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the ChatGPT Image Denial Auto-Retry userscript's retry machinery into the bridge's `generate_image()` so policy denials are retried automatically (same-chat "Try again", backoff waits, rate-limit parsing), while the prompt is always sent verbatim (pure bridge).

**Architecture:** New `retry.py` module holds pure logic: response classification (denial / rate-limit / deterministic / generic_fail / no_image), `RetryConfig` (tries/gaps/backoff), and rate-limit wait parsing. `ui_driver.generate_image()` gains a retry loop that races three outcomes per attempt (image appears / assistant text settles / "Try again" button appears), clicks "Try again" the instant it renders, falls back to the Switch-model popover trick for denials with no retry button, stops immediately on deterministic (IP/copyright) denials, and raises `GenerationDeniedError` when retries are exhausted. Retry is ON by default (`max_tries=3`), configurable via `ChatGPT(max_retries=...)`; daemon surfaces denials as 502 with `GenerationDeniedError` type.

**Tech Stack:** Python 3.10+, Playwright (async), pytest; existing bridge modules.

## Global Constraints

- Pure bridge: prompt sent **verbatim**. No guard/steer prefixes, no rephrasing, no reference-image upload.
- Retry ON by default (`max_tries=3`); `max_tries=1` disables retrying.
- Deterministic (IP/copyright) denials raise immediately — never retried.
- Errors (`GenerationDeniedError`) subclass `BridgeError` so the daemon's existing catch-all maps them.
- Every turn remains a fresh chat (existing behavior); chat-pool pruning unchanged.
- All code in `python/chatgpt_bridge/`; tests in `python/tests/`.
- Run tests with: `cd python && .venv/bin/python -m pytest -q`

## File Structure

- **Create** `python/chatgpt_bridge/retry.py` — `RetryConfig`, `classify_response`, `parse_rate_limit_wait`
- **Modify** `python/chatgpt_bridge/errors.py` — add `GenerationDeniedError`
- **Modify** `python/chatgpt_bridge/ui_driver.py` — retry loop, `_wait_for_outcome`, try-again click, switch-model fallback
- **Modify** `python/chatgpt_bridge/core.py` — `max_retries` param, passthrough
- **Modify** `python/chatgpt_bridge/daemon.py` — include `GenerationDeniedError` in the caught tuple for `/image`
- **Create** `python/tests/test_retry.py` — pure logic tests
- **Create** `python/tests/test_ui_retry.py` — retry-loop tests with fake page
- **Modify** `README.md` — document retry behavior/options

---

### Task 1: retry.py (classification + config) + GenerationDeniedError

**Files:**
- Create: `python/chatgpt_bridge/retry.py`
- Modify: `python/chatgpt_bridge/errors.py`
- Test: `python/tests/test_retry.py`

**Interfaces:**
- Produces:
  - `classify_response(text: str) -> str` returning one of `"denial" | "rate_limit" | "deterministic" | "generic_fail" | "no_image"`
  - `parse_rate_limit_wait(text: str) -> float | None` (seconds, capped at 600)
  - `RetryConfig` dataclass: `max_tries: int = 3`, `min_gap_s: float = 5.0`, `max_gap_s: float = 10.0`, `backoff: tuple = (0, 5, 15, 30, 60)`; method `delay_for(tries: int, rng=random.random) -> float` = random gap in [min_gap, max_gap] + backoff[min(tries-1, len-1)]
  - `GenerationDeniedError(BridgeError)` with `.kind: str` attribute

- [ ] **Step 1: Write the failing tests**

Create `python/tests/test_retry.py`:

```python
from chatgpt_bridge.errors import GenerationDeniedError, BridgeError
from chatgpt_bridge.retry import RetryConfig, classify_response, parse_rate_limit_wait


def test_denial():
    assert classify_response("I'm sorry, I can't create that image as it may violate content policy.") == "denial"


def test_deterministic_ip():
    assert classify_response("This request is too similar to third-party content protected by copyright.") == "deterministic"


def test_rate_limit():
    assert classify_response("Rate limit reached — try again in 5 minutes.") == "rate_limit"


def test_generic_fail():
    assert classify_response("Image generation failed. Something went wrong.") == "generic_fail"


def test_no_image():
    assert classify_response("Here is a story about dragons.") == "no_image"


def test_parse_minutes():
    assert parse_rate_limit_wait("try again in 5 minutes") == 300.0
    assert parse_rate_limit_wait("try again later") is None


def test_delay_bounds():
    cfg = RetryConfig()
    d = cfg.delay_for(1)
    assert 5.0 + 0 <= d <= 10.0 + 0
    d4 = cfg.delay_for(4)
    assert 5.0 + 30 <= d4 <= 10.0 + 30


def test_denied_error_is_bridge_error():
    err = GenerationDeniedError("denied", kind="deterministic")
    assert isinstance(err, BridgeError)
    assert err.kind == "deterministic"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd python && .venv/bin/python -m pytest tests/test_retry.py -v`
Expected: ImportError — chatgpt_bridge.retry does not exist

- [ ] **Step 3: Implement**

Add to `python/chatgpt_bridge/errors.py`:

```python
class GenerationDeniedError(BridgeError):
    """Image generation was denied or retries were exhausted."""

    def __init__(self, message: str, kind: str = "unknown") -> None:
        super().__init__(message)
        self.kind = kind
```

Create `python/chatgpt_bridge/retry.py`:

```python
"""Retry machinery for image generation denials (ported from the userscript)."""

from __future__ import annotations

import random
import re
from dataclasses import dataclass, field

REFUSAL_RE = re.compile(
    r"usage polic|content polic|may violate|don'?t comply|can'?t help|"
    r"policy forbids|not allowed to|safety|guardrails|"
    r"unable to (generate|create)|we'?re so sorry",
    re.IGNORECASE,
)
RATE_RE = re.compile(
    r"rate.?limit|too many (requests|tries)|try again (later|in|soon|after)",
    re.IGNORECASE,
)
DETERMINISTIC_RE = re.compile(
    r"similarity to third-?party|third-?party content|copyright|"
    r"intellectual property|trademark",
    re.IGNORECASE,
)
GENERIC_FAIL_RE = re.compile(
    r"image generation failed|something went wrong|error", re.IGNORECASE
)
RATE_MINUTES_RE = re.compile(r"(\d+)\s*(?:minute|min)", re.IGNORECASE)


def classify_response(text: str) -> str:
    """Classify an assistant response during image generation."""
    if DETERMINISTIC_RE.search(text):
        return "deterministic"
    if REFUSAL_RE.search(text):
        return "denial"
    if RATE_RE.search(text):
        return "rate_limit"
    if GENERIC_FAIL_RE.search(text):
        return "generic_fail"
    return "no_image"


def parse_rate_limit_wait(text: str) -> float | None:
    """Extract 'try again in N minutes' wait in seconds, capped at 600."""
    m = RATE_MINUTES_RE.search(text)
    if not m:
        return None
    return min(float(m.group(1)) * 60.0, 600.0)


@dataclass
class RetryConfig:
    """Tuning for the image-generation retry loop."""

    max_tries: int = 3
    min_gap_s: float = 5.0
    max_gap_s: float = 10.0
    backoff: tuple = (0, 5, 15, 30, 60)

    def delay_for(self, tries: int) -> float:
        """Random gap + backoff for attempt number ``tries`` (1-based)."""
        gap = random.uniform(
            min(self.min_gap_s, self.max_gap_s),
            max(self.min_gap_s, self.max_gap_s),
        )
        idx = min(max(tries - 1, 0), len(self.backoff) - 1)
        return gap + self.backoff[idx]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd python && .venv/bin/python -m pytest tests/test_retry.py -v`
Expected: 8 passed

- [ ] **Step 5: Commit**

```bash
git add python/chatgpt_bridge/retry.py python/chatgpt_bridge/errors.py python/tests/test_retry.py
git commit -m "feat(retry): denial classification, rate-limit parsing, RetryConfig"
```

---

### Task 2: ui_driver retry loop (try-again + switch-model fallback)

**Files:**
- Modify: `python/chatgpt_bridge/ui_driver.py`
- Test: `python/tests/test_ui_retry.py`

**Interfaces:**
- Consumes: `classify_response`, `parse_rate_limit_wait`, `RetryConfig` from Task 1; `GenerationDeniedError`.
- Produces:
  - `UIDriver.generate_image(prompt, timeout_s=180, retry: RetryConfig | None = None) -> dict` — returns `{"path", "prompt", "conversation_id"}`; `retry=None` means default `RetryConfig()`; a caller may pass `RetryConfig(max_tries=1)` to disable retries. Raises `GenerationDeniedError` (deterministic or exhausted) / `BridgeTimeoutError` (image never appears).
  - `TRY_AGAIN_RE = re.compile(r"try again|retry|regenerate", re.IGNORECASE)` module-level.

Design of the new `generate_image`:

```python
LOOKING_BUSY = '[data-testid="image-gen-loading-state"]'
SWITCH_MODEL = 'button[aria-label="Switch model"]'

async def generate_image(self, prompt, timeout_s=180, retry=None):
    cfg = retry or RetryConfig()
    last_kind = "no_image"
    last_text = ""
    for tries in range(1, cfg.max_tries + 1):
        if tries > 1:
            await asyncio.sleep(cfg.delay_for(tries))
        page = await self._page()
        try:
            await self._submit_prompt(page, prompt)
            outcome = await self._wait_for_outcome(page, timeout_s, cfg, tries)
            if outcome["kind"] == "image":
                ctx = await self.browser.context()
                path = await save_image(outcome["src"], _images_dir(), ctx.request)
                cid = await self._current_conversation_id(page)
                return {"path": str(path), "prompt": prompt, "conversation_id": cid}
            last_kind = outcome["kind"]
            last_text = outcome.get("text", "")
            if last_kind == "deterministic":
                raise GenerationDeniedError(last_text[:200] or "deterministic denial", kind="deterministic")
        finally:
            await page.close()
    raise GenerationDeniedError(
        f"image denied after {cfg.max_tries} tries (last: {last_kind})",
        kind=last_kind,
    )
```

`_wait_for_outcome(page, timeout_s, cfg, tries)` polls every 0.5s until `timeout_s`:

1. If `page.locator(IMAGE_SELECTOR).first` count > 0 → return `{"kind": "image", "src": <src>}`.
2. If a button whose inner text matches `TRY_AGAIN_RE` is visible → `await btn.click()`, return `{"kind": "retrying"}` so the outer loop continues polling on a fresh call (re-call `_wait_for_outcome` recursively or use a loop without counting as new try).
3. If `[data-testid="image-gen-loading-state"]` visible → reset text-settle counter, keep waiting.
4. Read last assistant turn text (existing `_read_last_assistant`); when text unchanged across 4 polls (settled) → `kind = classify_response(text)`. If kind is `denial` and no try-again button was seen, run the **switch-model fallback**: `page.keyboard.press("Escape")`, click the Switch-model button in the last conversation turn, poll 2s at 100ms for a try-again button, click it if found → `{"kind": "retrying"}`; else `{"kind": "denial", "text": text}`. For `rate_limit`, return `{"kind": "rate_limit", "text", "wait_s": parse_rate_limit_wait(text)}` and have the outer loop sleep `wait_s` (if present) before the next try.
5. On deadline → `BridgeTimeoutError`.

Note: the `retrying` outcome must not consume a try; restructure the loop as `while` on tries with `retrying` continuing without incrementing.

- [ ] **Step 1: Write the failing tests** with a scripted fake page (pattern follows `tests/test_images.py`'s fake page): fake `locator`/`keyboard` objects returning scripted sequences — e.g. attempt 1 returns settled denial text; the fake try-again button appears on poll 3; after click the fake returns an image src → `{"path", "conversation_id"}` success.

Test cases:
- denial → try-again click → image: returns path, 1 prompt submit
- deterministic denial → raises `GenerationDeniedError` with `kind == "deterministic"`, no retry
- always denial with no button (switch fallback finds nothing) → raises `GenerationDeniedError` after `RetryConfig(max_tries=2)`
- rate_limit with "in 1 minutes" → sleeps parsed wait (monkeypatch `asyncio.sleep` to record), then succeeds on try 2

- [ ] **Step 2: Run test to verify it fails**

Run: `cd python && .venv/bin/python -m pytest tests/test_ui_retry.py -v`
Expected: failures — `generate_image` has no `retry` param / no retry behavior

- [ ] **Step 3: Implement** per the design above in `ui_driver.py`.

- [ ] **Step 4: Run tests**

Run: `cd python && .venv/bin/python -m pytest tests/test_ui_retry.py tests/test_retry.py tests/test_images.py -v`
Expected: all pass (existing image tests unaffected)

- [ ] **Step 5: Commit**

```bash
git add python/chatgpt_bridge/ui_driver.py python/tests/test_ui_retry.py
git commit -m "feat(ui): image retry loop with try-again + switch-model fallback"
```

---

### Task 3: core + daemon wiring

**Files:**
- Modify: `python/chatgpt_bridge/core.py`
- Modify: `python/chatgpt_bridge/daemon.py`
- Test: `python/tests/test_daemon.py` (extend)

**Interfaces:**
- Consumes: `RetryConfig`, `GenerationDeniedError`, new `UIDriver.generate_image` signature.
- Produces:
  - `ChatGPT(..., max_retries: int = 3)` — stored; `generate_image(prompt, timeout_s=180)` builds `RetryConfig(max_tries=self._max_retries)` and passes it down.
  - Daemon `/image`: request model gains `max_tries: int | None = None`; the caught-exception tuple gains `GenerationDeniedError`.

- [ ] **Step 1: Write failing daemon test** — mocked core raising `GenerationDeniedError("x", kind="deterministic")` on `/image` → 502 with `{"error": {"type": "GenerationDeniedError", ...}}`.

- [ ] **Step 2: Run test, verify failure.**

- [ ] **Step 3: Implement**
  - `core.py`: `def __init__(self, headless=True, auto_relogin=False, max_chats=None, max_retries: int = 3)`; store `self.max_retries`; in `generate_image` call `self.ui.generate_image(prompt, timeout_s=timeout_s, retry=RetryConfig(max_tries=self.max_retries))`.
  - `daemon.py`: `from .errors import ..., GenerationDeniedError`; add `max_tries: int | None = None` to `ImageRequest`; pass through; add `GenerationDeniedError` to both except tuples.

- [ ] **Step 4: Run full suite**

Run: `cd python && .venv/bin/python -m pytest -q`
Expected: all pass (previously 54 + new)

- [ ] **Step 5: Commit**

```bash
git add python/chatgpt_bridge/core.py python/chatgpt_bridge/daemon.py python/tests/test_daemon.py
git commit -m "feat(core,daemon): max_retries plumbing + denial error mapping"
```

---

### Task 4: README + live E2E

**Files:**
- Modify: `README.md`
- Create: `python/run_retry_e2e.py` (manual E2E script)

- [ ] **Step 1: README** — new short section "Image retry behavior": default 3 tries with backoff, verbatim prompts, `GenerationDeniedError` / JS error `type`, `max_retries=1` to disable, `timeout_s` applies per attempt.

- [ ] **Step 2: Live E2E** (manual, needs xvfb):
   Run: `cd python && xvfb-run -a .venv/bin/python run_retry_e2e.py`
   Script: (a) `generate_image("a simple green triangle", timeout_s=300)` → expect success path; (b) a likely-denied prompt → expect `GenerationDeniedError` with log of kinds seen. Record results in script output; do not commit generated images.

- [ ] **Step 3: Commit**

```bash
git add README.md python/run_retry_e2e.py
git commit -m "docs: image retry behavior; manual E2E script"
```

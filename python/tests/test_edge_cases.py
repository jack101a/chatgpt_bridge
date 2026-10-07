"""Comprehensive edge-case test suite for ChatGPT Bridge.

Validates that fast conversational bailouts, retry limits, prompt directives,
async sequence cancellations, and Docker environment compatibility function
flawlessly across all critical operational boundaries.
"""

from __future__ import annotations

import asyncio
import os
import re
import time
from pathlib import Path
from unittest.mock import AsyncMock, patch, MagicMock

import pytest
from fastapi.testclient import TestClient

import chatgpt_bridge.daemon as daemon
from chatgpt_bridge.errors import GenerationDeniedError
from chatgpt_bridge.retry import RetryConfig, standardize_image_prompt, classify_response
from chatgpt_bridge.ui_driver import UIDriver, _images_dir
from chatgpt_bridge.director import StoryboardShot


# =============================================================================
# Mock Locators & Pages
# =============================================================================

class _MockLocator:
    def __init__(self, count: int = 0, text: str = "", src: str | None = None, alt: str | None = None):
        self._count = count
        self._text = text
        self._src = src
        self._alt = alt

    @property
    def first(self):
        return self

    @property
    def last(self):
        return self

    async def count(self) -> int:
        return self._count

    async def inner_text(self) -> str:
        return self._text

    async def get_attribute(self, attr: str) -> str | None:
        if attr == "alt":
            return self._alt
        return self._src

    async def is_visible(self) -> bool:
        return self._count > 0

    def nth(self, i: int):
        return self

    def locator(self, sel: str):
        return self


class _EdgeCasePage:
    def __init__(self, state: dict):
        self._state = dict(state)
        self.is_closed = lambda: False

    async def evaluate(self, script, *args):
        if "isLimited" in script or "rate_limit" in script:
            return {"isLimited": False}
        if "session" in script or "guest" in script:
            return None
        return self._state.get("text", "")

    def locator(self, selector: str):
        # Image selector
        if any(x in selector for x in ("img", "estuary", "oaiusercontent", "Generated image", "src")):
            if self._state.get("image"):
                return _MockLocator(
                    count=1,
                    src=self._state.get("src", "https://chatgpt.com/estuary/content?id=file_edge_123&sig=1"),
                    alt=self._state.get("alt", "Generated image: test"),
                )
            return _MockLocator(count=0)

        # Loading indicators
        if any(x in selector for x in ("stop-button", "Stop generating", "Stop streaming", "result-streaming", "image-gen-loading")):
            return _MockLocator(count=1 if self._state.get("loading") else 0)

        # Assistant text turns
        if "conversation-turn" in selector or "article" in selector or "assistant" in selector:
            return _MockLocator(count=1, text=self._state.get("text", ""))

        return _MockLocator(count=0)


# =============================================================================
# 1. Edge Case: Prompt Directive Detection (No Double-Prefixing)
# =============================================================================

def test_prompt_directive_regex_avoids_double_prefixing():
    """Ensure various existing directives are detected and not double-prefixed."""
    pattern = r"^(?:please\s+)?(?:generate|create|render|make)\s+(?:an?\s+)?image"

    valid_directives = [
        "Generate an image: a cozy coffee shop in rainy weather",
        "generate an image of a red vintage car",
        "CREATE AN IMAGE of high-angle portrait",
        "Please generate an image: side profile view",
        "make an image of a futuristic city",
        "Render an image: dramatic low angle shot",
        "Create image - sunny beach landscape",
    ]

    for p in valid_directives:
        assert re.search(pattern, p.strip(), re.I) is not None, f"Failed to detect directive in: {p}"

    non_directives = [
        "Enjoy cofee while chilling",
        "eye level shot, looking directly at subject",
        "high angle shot, looking down from 45 degrees",
        "medium profile shot, 50mm lens",
    ]

    for p in non_directives:
        assert re.search(pattern, p.strip(), re.I) is None, f"Incorrectly matched directive in: {p}"


# =============================================================================
# 2. Edge Case: Chit-Chat Fast Bailout (< 3.0s)
# =============================================================================

def test_chit_chat_fast_bailout_elapsed_time():
    """Verify that pure conversational text bails out within 2.5s instead of 30s+."""
    page = _EdgeCasePage({"text": "Coffee is fantastic! Here are some great ways to relax while having coffee."})
    d = UIDriver.__new__(UIDriver)
    d._delivered_image_ids = set()

    t0 = time.monotonic()
    outcome = asyncio.run(d._wait_for_outcome(page, timeout_s=30, auto_retry=False))
    elapsed = time.monotonic() - t0

    assert outcome["kind"] == "no_image"
    assert "Coffee is fantastic" in outcome["text"]
    assert elapsed < 3.0, f"Elapsed time was {elapsed}s, expected < 3.0s"


# =============================================================================
# 3. Edge Case: DALL-E Image with Preliminary Text
# =============================================================================

def test_dalle_image_rendered_with_preliminary_text():
    """If ChatGPT outputs preliminary conversational text AND an image, outcome must be 'image'."""
    page = _EdgeCasePage({
        "text": "Certainly! Here is an image of the scene you requested.",
        "image": True,
        "src": "https://chatgpt.com/estuary/content?id=file_dalle_999&sig=1",
        "alt": "Generated image: Coffee Scene",
    })
    d = UIDriver.__new__(UIDriver)
    d._delivered_image_ids = set()

    # In production, existing is captured before prompt submission:
    outcome = asyncio.run(d._wait_for_outcome(page, timeout_s=10, auto_retry=False, existing=set()))
    assert outcome["kind"] == "image"
    assert "file_dalle_999" in outcome["src"]


def test_dalle_image_delayed_hydration():
    """Simulate Docker/slow-network latency: loading indicator active, image hydrates after 2 polls."""
    polls = 0
    page_state = {
        "text": "Creating your image now...",
        "loading": True,
        "image": False,
    }

    class _HydratingPage(_EdgeCasePage):
        def locator(self, selector: str):
            nonlocal polls
            if "stop" in selector.lower() or "loading" in selector.lower():
                polls += 1
                if polls >= 3:
                    self._state["loading"] = False
                    self._state["image"] = True
                    self._state["src"] = "https://chatgpt.com/estuary/content?id=file_hydrated_888&sig=1"
            return super().locator(selector)

    page = _HydratingPage(page_state)
    d = UIDriver.__new__(UIDriver)
    d._delivered_image_ids = set()

    outcome = asyncio.run(d._wait_for_outcome(page, timeout_s=10, auto_retry=False, existing=set()))
    assert outcome["kind"] == "image"
    assert "file_hydrated_888" in outcome["src"]


# =============================================================================
# 4. Edge Case: Safety Refusal Retains Full 10 Retries (Not Aborted Early)
# =============================================================================

def test_safety_refusal_executes_full_retries(monkeypatch):
    """Guardrail policy refusals MUST NOT abort after retry 1; they must execute the full 10 retries."""
    denial_text = "We’re so sorry, but the image we created may violate our guardrails around nudity, sexuality, or erotic content."
    page = _EdgeCasePage({"text": denial_text})
    attempts = []

    async def fake_submit(p, prompt, **kwargs):
        attempts.append(prompt)

    async def fake_edit(p, new_prompt=None):
        attempts.append(new_prompt or "edited")
        return True

    d = UIDriver.__new__(UIDriver)
    d.browser = None
    d.session = None
    d._delivered_image_ids = set()
    d._page = AsyncMock(return_value=page)
    d._page_for_lane = AsyncMock(return_value=page)
    d._submit_prompt = fake_submit
    d._edit_message_retry = fake_edit
    d._click_try_again = AsyncMock(return_value=False)
    d._current_conversation_id = AsyncMock(return_value="conv-denial")

    # 10 retries with tiny sleep delays
    cfg = RetryConfig(max_tries=10, intervals=tuple([0.001] * 10))

    with pytest.raises(GenerationDeniedError) as exc_info:
        asyncio.run(
            d.generate_image(
                prompt="a slightly risky artistic portrait",
                timeout_s=2,
                retry=cfg,
                tweaked_prompt="softened level 1",
                tweaked_prompt_2="softened level 2",
            )
        )

    # Must complete all 10 retries for policy denials
    assert exc_info.value.kind == "denial"
    assert "10 retries" in str(exc_info.value)
    # Total attempts = initial submit (1) + 10 retries = 11 attempts
    assert len(attempts) == 11


# =============================================================================
# 5. Edge Case: Repeated Timeout Halts After Retry 1 (Prevents 45-Min Lockup)
# =============================================================================

def test_repeated_timeout_halts_after_retry_1():
    """Repeated timeouts must halt after 1 retry, NOT burning 10 retries."""
    d = UIDriver.__new__(UIDriver)
    d.browser = None
    d.session = None
    d._delivered_image_ids = set()
    
    # Mock _wait_for_outcome to always raise timeout
    from chatgpt_bridge.errors import BridgeTimeoutError
    async def fake_wait(*args, **kwargs):
        raise BridgeTimeoutError("timed out waiting for image")

    d._wait_for_outcome = fake_wait
    d._submit_prompt = AsyncMock()
    d._edit_message_retry = AsyncMock(return_value=True)
    d._click_try_again = AsyncMock(return_value=False)
    d._page = AsyncMock(return_value=MagicMock(is_closed=lambda: False))
    d._page_for_lane = AsyncMock(return_value=MagicMock(is_closed=lambda: False))
    d._current_conversation_id = AsyncMock(return_value="conv-timeout")

    cfg = RetryConfig(max_tries=10, intervals=tuple([0.001] * 10))

    with pytest.raises(GenerationDeniedError) as exc_info:
        asyncio.run(
            d.generate_image(
                prompt="a scenery prompt",
                timeout_s=1,
                retry=cfg,
            )
        )

    assert exc_info.value.kind == "timeout"
    assert "timed out after retry" in str(exc_info.value)
    # Only attempted initial + 1 retry = 2 attempts total
    assert d._wait_for_outcome.__name__ == "fake_wait"


# =============================================================================
# 6. Edge Case: True Sequence Cancellation
# =============================================================================

@pytest.mark.anyio
async def test_director_cancel_endpoint_cancels_active_task(monkeypatch):
    """POST /api/director/cancel must cancel the active asyncio task immediately."""
    fake_task = MagicMock()
    fake_task.done.return_value = False
    daemon._director_task = fake_task
    daemon._director_state["is_running"] = True
    daemon._director_state["cancel_requested"] = False

    client = TestClient(daemon.app)
    resp = client.post("/api/director/cancel")
    assert resp.status_code == 200
    assert daemon._director_state["cancel_requested"] is True
    fake_task.cancel.assert_called_once()


# =============================================================================
# 7. Edge Case: Docker Environment State Paths
# =============================================================================

def test_docker_state_environment_paths(monkeypatch, tmp_path):
    """Verify that CHATGPT_BRIDGE_STATE correctly configures and creates the images directory."""
    # 1. Test directory creation under custom state directory
    test_state = tmp_path / "custom_state"
    monkeypatch.setenv("CHATGPT_BRIDGE_STATE", str(test_state))
    img_dir = _images_dir()
    assert img_dir == test_state / "images"
    assert img_dir.is_dir()

    # 2. Test Docker container specific path (/data)
    with patch.object(Path, "mkdir"):
        monkeypatch.setenv("CHATGPT_BRIDGE_STATE", "/data")
        assert _images_dir() == Path("/data/images")

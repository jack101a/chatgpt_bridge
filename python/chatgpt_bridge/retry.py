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

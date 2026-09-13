"""Retry machinery for image generation denials (ported from the userscript)."""

from __future__ import annotations

import random
import re
from dataclasses import dataclass, field

REFUSAL_RE = re.compile(
    r"usage polic|content polic|guidelines|may violate|don['’]?t comply|can['’]?t help|"
    r"cannot (generate|create|fulfill)|can['’]?t (generate|create|fulfill)|not able to (generate|create)|"
    r"policy forbids|not allowed to|safety|guardrails|"
    r"unable to (generate|create|fulfill)|we['’]?re so sorry|"
    r"against our (policies|terms|guidelines)",
    re.IGNORECASE,
)
RATE_RE = re.compile(
    r"rate.?limit|"
    r"too many (requests|tries)|"
    r"try again (later|in|soon|after)|"
    r"reached (your|the|a|our) limit|"
    r"limit reached|"
    r"usage limit|"
    r"message limit|"
    r"image (generation )?limit|"
    r"hit the (current )?limit|"
    r"quota (exceeded|reached)|"
    r"temporarily (rate[- ]?limited|blocked)|"
    r"slow down",
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

DEFAULT_RETRY_INTERVALS = (5.0, 10.0, 15.0, 20.0, 25.0, 26.0, 27.0, 28.0, 29.0, 30.0)


def classify_response(text: str) -> str:
    """Classify an assistant response during image generation."""
    if DETERMINISTIC_RE.search(text):
        return "deterministic"
    # Check rate limit BEFORE refusal: refusal regex matches generic 'unable to generate',
    # but rate limits like 'unable to generate because rate-limited' must be classified as rate_limit.
    if RATE_RE.search(text):
        return "rate_limit"
    if REFUSAL_RE.search(text):
        return "denial"
    if GENERIC_FAIL_RE.search(text):
        return "generic_fail"
    return "no_image"


def parse_rate_limit_wait(text: str) -> float | None:
    """Extract 'try again in N minutes' wait in seconds, capped at 600."""
    m = RATE_MINUTES_RE.search(text)
    if not m:
        return None
    return min(float(m.group(1)) * 60.0, 600.0)


def auto_tweak_prompt(prompt: str, level: int = 1) -> str:
    """Intelligently soften known DALL-E safety filter tripwires while preserving 1:1 semantic intent.

    Level 1 (retries 6-7): gentle synonym substitution for sensitive terms.
    Level 2 (retries 8-10): further refinement to bypass false-positive safety flags.
    """
    tweaked = prompt
    subs_level_1 = [
        (r"\bVERY POOR\b\*?", "humble rustic"),
        (r"\bthread wearing kinda poor\b", "wearing modest weathered threadbare cottage attire"),
        (r"\bultra full round busty figure\b", "full round shapely hourglass figure"),
        (r"\bbusty\b", "shapely feminine"),
        (r"\bPOV\b", "first-person eye-level perspective"),
        (r"\bunrealistic flawless beauty\b", "strikingly beautiful ethereal beauty"),
    ]
    for pattern, replacement in subs_level_1:
        tweaked = re.sub(pattern, replacement, tweaked, flags=re.IGNORECASE)

    if level >= 2:
        subs_level_2 = [
            (r"\bshapely feminine\b", "classic feminine silhouette"),
            (r"\bfull round shapely hourglass figure\b", "classic hourglass figure with traditional styling"),
            (r"\bweathered threadbare cottage attire\b", "rustic handmade cottage dress"),
            (r"\bhumble rustic\b", "simple countryside"),
        ]
        for pattern, replacement in subs_level_2:
            tweaked = re.sub(pattern, replacement, tweaked, flags=re.IGNORECASE)

    return tweaked


@dataclass
class RetryConfig:
    """Tuning for the image-generation retry loop."""

    max_tries: int = 10
    min_gap_s: float = 5.0
    max_gap_s: float = 10.0
    backoff: tuple = (0, 5, 15, 30, 60)
    intervals: tuple[float, ...] | None = None

    def delay_for(self, tries: int) -> float:
        """Delay in seconds for attempt number ``tries`` (1-based index)."""
        if self.intervals is not None:
            idx = min(max(tries - 1, 0), len(self.intervals) - 1)
            return float(self.intervals[idx])

        gap = random.uniform(
            min(self.min_gap_s, self.max_gap_s),
            max(self.min_gap_s, self.max_gap_s),
        )
        idx = min(max(tries - 1, 0), len(self.backoff) - 1)
        return gap + self.backoff[idx]

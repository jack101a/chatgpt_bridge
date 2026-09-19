"""Retry machinery for image generation denials (ported from the userscript)."""

from __future__ import annotations

import datetime
import random
import re
import time
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


def parse_rate_limit_info(text: str, current_time: float | None = None) -> dict:
    """Extract detailed rate limit timeout (hours, minutes, absolute times) into seconds and reset timestamp."""
    now = current_time if current_time is not None else time.time()
    t = text.lower()

    hours = 0.0
    minutes = 0.0

    # 1. Match hours (e.g. "in 2 hours", "3.5 hours")
    m_h = re.search(r"(\d+(?:\.\d+)?)\s*hours?", t)
    if m_h:
        hours = float(m_h.group(1))

    # 2. Match minutes (e.g. "in 45 minutes")
    m_m = re.search(r"(\d+(?:\.\d+)?)\s*minutes?", t)
    if m_m:
        minutes = float(m_m.group(1))

    total_sec = hours * 3600.0 + minutes * 60.0

    # 3. Match absolute clock times like "after 6:30 pm", "after 18:30", "at 5:00 am"
    m_time = re.search(r"(?:after|at)\s+(\d{1,2}):(\d{2})(?:\s*(am|pm))?", t)
    if total_sec == 0 and m_time:
        target_h = int(m_time.group(1))
        target_m = int(m_time.group(2))
        ampm = m_time.group(3)
        if ampm:
            if ampm == "pm" and target_h < 12:
                target_h += 12
            elif ampm == "am" and target_h == 12:
                target_h = 0
        now_dt = datetime.datetime.fromtimestamp(now)
        target_dt = now_dt.replace(hour=target_h, minute=target_m, second=0, microsecond=0)
        if target_dt <= now_dt:
            target_dt += datetime.timedelta(days=1)
        total_sec = (target_dt - now_dt).total_seconds()

    if total_sec <= 0:
        total_sec = 3600.0 * 3.0  # default 3 hours fallback

    resets_at = now + total_sec
    resets_dt = datetime.datetime.fromtimestamp(resets_at)
    human_time = resets_dt.strftime("%H:%M")

    return {
        "wait_seconds": total_sec,
        "resets_at": resets_at,
        "resets_at_str": human_time,
        "hours": round(total_sec / 3600.0, 1),
    }


_LEADING_GEN_IMAGE_RE = re.compile(
    r"^(?:please\s+)?(?:generate|genrate|create|make)\s+(?:an?\s+)?image\s*(?:of|:|-)?\s*",
    re.IGNORECASE,
)


def standardize_image_prompt(prompt: str) -> str:
    """Clean and standardize image prompt by stripping robotic prefixes and wrappers.

    Strips:
    - Leading '(Generate Image -\\n...)' wrappers and matching trailing ')'
    - 'Please generate an image using the exact prompt below...' directives
    - Leading 'Generate image:', 'Create an image of:', etc.
    Returns the pure, clean scene prompt string without robotic clutter.
    """
    t = prompt.strip()

    # 1. Strip '(Generate Image -\n...)' or '(Genrate Image -\n...)'
    if t.startswith("(") and (
        t.lower().startswith("(generate image -\n")
        or t.lower().startswith("(genrate image -\n")
        or t.lower().startswith("(generate image -")
    ):
        inner = t[1:]
        if inner.endswith(")"):
            inner = inner[:-1]
        parts = re.split(r"^(?:generate|genrate)\s+image\s*-\s*\n?", inner.strip(), flags=re.IGNORECASE)
        t = parts[-1].strip()

    # 2. Strip verbatim / exact prompt directives
    prefix_verbatim = "Please generate an image using the exact prompt below. Do not rewrite, expand, or alter this text; pass it verbatim to the dalle tool:"
    if t.startswith(prefix_verbatim):
        t = t[len(prefix_verbatim):].strip().strip('"')
    elif "using the exact prompt below" in t.lower() and "pass it verbatim" in t.lower():
        parts = re.split(r"pass it verbatim to the dalle tool:\s*", t, flags=re.IGNORECASE)
        if len(parts) > 1:
            t = parts[-1].strip().strip('"')

    # 3. Strip leading command prefixes like "generate image:", "please make an image of"
    cleaned = _LEADING_GEN_IMAGE_RE.sub("", t).strip()
    if cleaned:
        t = cleaned

    # Strip any dangling wrapping quotes
    if (t.startswith('"') and t.endswith('"')) or (t.startswith("'") and t.endswith("'")):
        t = t[1:-1].strip()

    return t


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

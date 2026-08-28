"""Cookie file parsing and validation for chatgpt-bridge.

Supports two on-disk formats:

* Netscape ``cookies.txt`` (tab-separated, ``#`` comments).
* A JSON array of cookie objects ``[{name, value, domain, path, expires, ...}]``.

Both are normalized into Playwright-style cookie dicts.
"""

from __future__ import annotations

import json
import time
from pathlib import Path

# The session cookie that proves a logged-in ChatGPT web session.
SESSION_COOKIE = "__Secure-next-auth.session-token"

# Defaults applied when a JSON cookie omits optional fields.
_DEFAULT_DOMAIN = "chatgpt.com"
_DEFAULT_PATH = "/"
_DEFAULT_EXPIRES = -1
_DEFAULT_SECURE = True
_DEFAULT_SAMESITE = "Lax"


class CookieFormatError(ValueError):
    """Raised when a cookie file cannot be parsed."""


def _normalize_json_cookie(raw: dict) -> dict:
    """Normalize a single JSON cookie dict into Playwright shape."""
    name = raw.get("name")
    value = raw.get("value")
    if not name or value is None:
        raise CookieFormatError(f"cookie missing name/value: {raw!r}")

    domain = raw.get("domain") or _DEFAULT_DOMAIN
    if not domain.startswith("."):
        domain = "." + domain

    expires = raw.get("expires", _DEFAULT_EXPIRES)
    if expires is None:
        expires = _DEFAULT_EXPIRES

    return {
        "name": name,
        "value": value,
        "domain": domain,
        "path": raw.get("path") or _DEFAULT_PATH,
        "expires": expires,
        "secure": bool(raw.get("secure", _DEFAULT_SECURE)),
        "httpOnly": bool(raw.get("httpOnly", False)),
        "sameSite": raw.get("sameSite") or _DEFAULT_SAMESITE,
    }


def _parse_json(text: str) -> list[dict]:
    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        raise CookieFormatError(f"invalid JSON cookie file: {exc}") from exc

    if not isinstance(data, list):
        raise CookieFormatError("JSON cookie file must be an array of cookie objects")

    return [_normalize_json_cookie(item) for item in data]


def _parse_netscape(text: str) -> list[dict]:
    """Parse a Netscape ``cookies.txt`` blob into Playwright-style cookies."""
    cookies: list[dict] = []
    for lineno, line in enumerate(text.splitlines(), start=1):
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        fields = stripped.split("\t")
        if len(fields) != 7:
            raise CookieFormatError(
                f"cookies.txt line {lineno}: expected 7 tab-separated fields, "
                f"got {len(fields)}"
            )
        domain, tailmatch, path, secure, expires, name, value = fields
        try:
            expires_int = int(expires)
        except ValueError as exc:
            raise CookieFormatError(
                f"cookies.txt line {lineno}: invalid expires value {expires!r}"
            ) from exc

        cookies.append(
            {
                "name": name,
                "value": value,
                "domain": domain,
                "path": path,
                "expires": expires_int,
                "secure": secure.lower() == "true",
                "httpOnly": False,
                "sameSite": _DEFAULT_SAMESITE,
            }
        )
    return cookies


def load_cookie_file(path: str | Path) -> list[dict]:
    """Load cookies from a Netscape ``.txt`` or JSON ``.json`` file.

    Returns a list of Playwright-style cookie dicts.
    """
    p = Path(path)
    text = p.read_text(encoding="utf-8")
    suffix = p.suffix.lower()
    if suffix == ".json":
        return _parse_json(text)
    if suffix == ".txt":
        return _parse_netscape(text)
    # Fall back to sniffing: JSON arrays start with '['.
    if text.lstrip().startswith("["):
        return _parse_json(text)
    return _parse_netscape(text)


def cookies_valid(cookies: list[dict]) -> bool:
    """Return True iff a valid, unexpired session-token cookie is present."""
    now = time.time()
    for c in cookies:
        if c.get("name") == SESSION_COOKIE:
            exp = c.get("expires", -1)
            if exp == -1 or exp > now:
                return True
    return False
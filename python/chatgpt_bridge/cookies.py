"""Cookie file parsing and validation for chatgpt-bridge.

Supports three on-disk formats, detected by CONTENT (not file extension):

* Netscape ``cookies.txt`` (tab-separated, ``#`` comments).
* A JSON array of cookie objects ``[{name, value, domain, path, expires, ...}]``.
* A Chrome-extension (Cookie-Editor style) wrapper object
  ``{"url": ..., "cookies": [...]}`` where each cookie may use
  ``expirationDate`` (float) and ``sameSite`` values like ``"lax"``,
  ``"no_restriction"``, ``"strict"``, or ``"unspecified"``.

All are normalized into Playwright-style cookie dicts.
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

# Map Chrome-extension sameSite values onto Playwright's canonical casing.
_SAMESITE_MAP = {
    "lax": "Lax",
    "strict": "Strict",
    "no_restriction": "None",
    "none": "None",
    "unspecified": "Lax",
}


class CookieFormatError(ValueError):
    """Raised when a cookie file cannot be parsed."""


def _normalize_json_cookie(raw: dict) -> dict:
    """Normalize a single JSON cookie dict into a Chromium-safe Playwright shape.

    Rules applied so ``context.add_cookies`` does not reject the cookie:

    * ``expires`` is coerced to ``int`` (Chromium rejects floats).
    * ``sameSite: "None"`` requires ``secure: true``; if the cookie is not
      secure, ``sameSite`` is downgraded to ``"Lax"``.
    * Host-only cookies (Chrome exports ``hostOnly: true`` with a domain that
      has no leading dot) are emitted in ``url`` form
      ``https://<domain><path>`` with the ``domain`` field dropped, which is
      the unambiguous way to set a host-only cookie in Playwright.
    """
    name = raw.get("name")
    value = raw.get("value")
    if not name or value is None:
        raise CookieFormatError(f"cookie missing name/value: {raw!r}")

    domain = raw.get("domain") or _DEFAULT_DOMAIN
    path = raw.get("path") or _DEFAULT_PATH
    host_only = bool(raw.get("hostOnly", False))

    # expires <- "expires" else "expirationDate" else -1; always int.
    expires = raw.get("expires")
    if expires is None:
        expires = raw.get("expirationDate")
    if expires is None:
        expires = _DEFAULT_EXPIRES
    expires = int(expires)

    secure = bool(raw.get("secure", _DEFAULT_SECURE))

    # Normalize sameSite casing; unknown/missing -> "Lax".
    same_site = raw.get("sameSite")
    if same_site is None:
        same_site = _DEFAULT_SAMESITE
    else:
        same_site = _SAMESITE_MAP.get(str(same_site).lower(), _DEFAULT_SAMESITE)

    # "None" requires secure; downgrade insecure "None" to "Lax".
    if same_site == "None" and not secure:
        same_site = "Lax"

    common = {
        "name": name,
        "value": value,
        "expires": expires,
        "secure": secure,
        "httpOnly": bool(raw.get("httpOnly", False)),
        "sameSite": same_site,
    }

    if host_only or name.startswith("__Host-"):
        # url-form host-only cookie; Playwright requires EITHER url OR
        # domain+path, not both — so drop domain AND path here.
        clean_domain = domain.lstrip(".")
        return {**common, "url": f"https://{clean_domain}{path}"}

    if not domain.startswith("."):
        domain = "." + domain
    return {**common, "domain": domain, "path": path}


def _clean_cookie_text(text: str) -> str:
    """Strip markdown code fences (```json ... ```) or quotes ('...' / \"\"\") from pasted cookie text."""
    stripped = text.strip()
    if stripped.startswith("```"):
        lines = stripped.splitlines()
        if len(lines) >= 2 and lines[-1].strip().startswith("```"):
            stripped = "\n".join(lines[1:-1]).strip()
        elif lines[0].startswith("```"):
            stripped = "\n".join(lines[1:]).strip()
    for quote in ("'''", '"""'):
        if stripped.startswith(quote) and stripped.endswith(quote) and len(stripped) >= 6:
            stripped = stripped[3:-3].strip()
        elif stripped.startswith(quote):
            stripped = stripped[3:].strip()
        if stripped.endswith(quote):
            stripped = stripped[:-3].strip()
    return stripped.strip()


def _parse_json(text: str) -> list[dict]:
    cleaned = _clean_cookie_text(text)
    raw_items: list = []
    try:
        data = json.loads(cleaned)
        raw_items = data if isinstance(data, list) else [data]
    except json.JSONDecodeError:
        # Fall back to decoding multiple JSON objects (NDJSON, comma-separated objects without brackets)
        try:
            decoder = json.JSONDecoder()
            idx = 0
            while idx < len(cleaned):
                while idx < len(cleaned) and (cleaned[idx].isspace() or cleaned[idx] == ","):
                    idx += 1
                if idx >= len(cleaned):
                    break
                obj, end_idx = decoder.raw_decode(cleaned, idx)
                if isinstance(obj, list):
                    raw_items.extend(obj)
                else:
                    raw_items.append(obj)
                idx = end_idx
        except Exception as exc:
            raise CookieFormatError(f"invalid JSON cookie file: {exc}") from exc

    if not raw_items:
        raise CookieFormatError("no cookie data found in JSON input")

    cookies: list[dict] = []
    for item in raw_items:
        if not isinstance(item, dict):
            continue
        if isinstance(item.get("cookies"), list):
            # Chrome-extension wrapper object {"url": ..., "cookies": [...]}
            cookies.extend(item["cookies"])
        elif isinstance(item.get("data"), list):
            cookies.extend(item["data"])
        elif "name" in item and "value" in item:
            # Single cookie dictionary {"name": "...", "value": "...", ...}
            cookies.append(item)
        elif any(
            k in (SESSION_COOKIE, "next-auth.session-token", "session-token")
            or k.startswith(f"{SESSION_COOKIE}.")
            or k.startswith("next-auth.session-token.")
            for k in item.keys()
        ):
            # Flat key-value dict {SESSION_COOKIE: "...", ...}
            for k, v in item.items():
                if isinstance(v, dict):
                    cookies.append({"name": k, **v})
                elif isinstance(v, (str, int, float, bool)):
                    cookies.append({"name": k, "value": str(v)})

    if not cookies:
        raise CookieFormatError(
            "JSON cookie file must contain cookie objects (with 'name' and 'value'), "
            "an array of cookies, or a {'url': ..., 'cookies': [...]} wrapper object"
        )

    return [_normalize_json_cookie(item) for item in cookies]


def _parse_header_string(text: str) -> list[dict]:
    """Parse HTTP 'Cookie:' header or semicolon-separated 'name=val; name2=val2' string."""
    cleaned = text.strip()
    if cleaned.lower().startswith("cookie:"):
        cleaned = cleaned[7:].strip()
    cookies = []
    for part in cleaned.split(";"):
        part = part.strip()
        if not part or "=" not in part:
            continue
        name, value = part.split("=", 1)
        name = name.strip()
        value = value.strip()
        if name:
            cookies.append(_normalize_json_cookie({"name": name, "value": value}))
    if not cookies:
        raise CookieFormatError("no key=value pairs found in cookie string")
    return cookies


def _parse_netscape(text: str) -> list[dict]:
    """Parse a Netscape ``cookies.txt`` blob into Playwright-style cookies."""
    cookies: list[dict] = []
    for lineno, line in enumerate(text.splitlines(), start=1):
        stripped = line.strip()
        if not stripped:
            continue
        is_http_only = False
        if stripped.startswith("#HttpOnly_"):
            is_http_only = True
            stripped = stripped[len("#HttpOnly_"):]
        elif stripped.startswith("#"):
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
                "httpOnly": is_http_only,
                "sameSite": _DEFAULT_SAMESITE,
            }
        )
    return cookies


def parse_cookie_text(text: str) -> list[dict]:
    """Parse cookie text in JSON, Netscape, HTTP Header, or raw session token format."""
    stripped = _clean_cookie_text(text)
    if not stripped:
        return []
    # 1. JSON format (Cookie-Editor, EditThisCookie, Cookiebro, NDJSON, single cookie, etc.)
    if stripped.startswith(("{", "[")):
        try:
            return _parse_json(stripped)
        except Exception:
            pass
    # 2. Raw JWT session token (e.g. eyJhbGciOi...)
    if stripped.startswith("eyJ") and len(stripped) > 50 and "\t" not in stripped and "\n" not in stripped:
        return [_normalize_json_cookie({"name": SESSION_COOKIE, "value": stripped})]
    # 3. Netscape format (tab-separated or commented lines)
    if "\t" in stripped or stripped.startswith("#"):
        try:
            return _parse_netscape(stripped)
        except Exception:
            pass
    # 4. HTTP Cookie header or semicolon-delimited key=value
    if "=" in stripped:
        try:
            return _parse_header_string(stripped)
        except Exception:
            pass
    # Fallback to Netscape
    return _parse_netscape(stripped)


def is_cookie_content(text: str) -> bool:
    """Check if a string appears to be exported ChatGPT session cookies or token."""
    stripped = _clean_cookie_text(text)
    if not stripped:
        return False
    if "session-token" in stripped or "__Secure" in stripped:
        return True
    if stripped.startswith(("{", "[")) and (
        "name" in stripped or "cookies" in stripped or "domain" in stripped or "value" in stripped
    ):
        return True
    if "#HttpOnly_" in stripped or ("\tTRUE\t" in stripped or "\tFALSE\t" in stripped):
        return True
    if stripped.lower().startswith("cookie:") and "=" in stripped:
        return True
    if stripped.startswith("eyJ") and len(stripped) > 80 and "." in stripped:
        return True
    return False


def looks_like_cookie_or_token(text: str) -> bool:
    """Check if text appears to be cookie data, tokens, or cookie file fragments."""
    stripped = _clean_cookie_text(text)
    if not stripped:
        return False
    if is_cookie_content(stripped):
        return True
    lower = stripped.lower()
    indicators = (
        "session-token",
        "__secure",
        "expirationdate",
        "samesite",
        "httponly",
        '"domain":',
        "'domain':",
        '"path":',
        "cf_clearance",
        "_puid",
        "chatgpt.com",
    )
    matched = sum(1 for ind in indicators if ind in lower)
    if matched >= 2:
        return True
    if (stripped.startswith(("[{", "{", "[")) or stripped.endswith(("}]", "}"))) and any(ind in lower for ind in indicators):
        return True
    return False


def load_cookie_file(path: str | Path) -> list[dict]:
    """Load cookies from a Netscape or JSON cookie file.

    Format is detected by content: if the trimmed text starts with ``{`` or
    ``[`` it is parsed as JSON, otherwise as Netscape ``cookies.txt``.

    Returns a list of Playwright-style cookie dicts.
    """
    p = Path(path)
    text = p.read_text(encoding="utf-8")
    return parse_cookie_text(text)


def cookies_valid(cookies: list[dict]) -> bool:
    """Return True iff a valid, unexpired session-token cookie is present."""
    now = time.time()
    for c in cookies:
        name = c.get("name", "")
        if (
            name in (SESSION_COOKIE, "next-auth.session-token", "session-token")
            or name.startswith(f"{SESSION_COOKIE}.")
            or name.startswith("next-auth.session-token.")
            or name.startswith("session-token.")
        ):
            exp = c.get("expires", -1)
            if exp == -1 or exp > now:
                return True
    return False
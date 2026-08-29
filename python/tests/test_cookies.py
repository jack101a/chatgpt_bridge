"""Unit tests for chatgpt_bridge.cookies (no live session required)."""

from __future__ import annotations

import json
import time

import pytest

from chatgpt_bridge.cookies import (
    CookieFormatError,
    SESSION_COOKIE,
    cookies_valid,
    load_cookie_file,
)


def _session_cookie(expires: int = -1) -> dict:
    return {
        "name": SESSION_COOKIE,
        "value": "abc123",
        "domain": ".chatgpt.com",
        "path": "/",
        "expires": expires,
        "secure": True,
        "httpOnly": True,
        "sameSite": "Lax",
    }


def test_cookies_valid_true_for_unexpired_session_cookie():
    cookies = [_session_cookie(expires=int(time.time()) + 3600)]
    assert cookies_valid(cookies) is True


def test_cookies_valid_true_for_session_cookie_without_expiry():
    cookies = [_session_cookie(expires=-1)]
    assert cookies_valid(cookies) is True


def test_cookies_valid_false_for_expired_session_cookie():
    cookies = [_session_cookie(expires=int(time.time()) - 10)]
    assert cookies_valid(cookies) is False


def test_cookies_valid_false_when_session_cookie_missing():
    cookies = [{"name": "other", "value": "x", "expires": -1}]
    assert cookies_valid(cookies) is False


def test_cookies_valid_false_for_empty_list():
    assert cookies_valid([]) is False


def test_load_json_cookie_file_normalizes_fields(tmp_path):
    raw = [
        {
            "name": SESSION_COOKIE,
            "value": "tok",
            "domain": "chatgpt.com",
            "path": "/",
            "expires": -1,
        }
    ]
    p = tmp_path / "cookies.json"
    p.write_text(json.dumps(raw), encoding="utf-8")

    cookies = load_cookie_file(p)
    assert len(cookies) == 1
    c = cookies[0]
    assert c["name"] == SESSION_COOKIE
    assert c["value"] == "tok"
    assert c["domain"] == ".chatgpt.com"  # leading dot added
    assert c["path"] == "/"
    assert c["expires"] == -1
    assert c["secure"] is True
    assert c["sameSite"] == "Lax"


def test_load_json_cookie_file_defaults_missing_fields(tmp_path):
    raw = [{"name": "foo", "value": "bar"}]
    p = tmp_path / "cookies.json"
    p.write_text(json.dumps(raw), encoding="utf-8")

    cookies = load_cookie_file(p)
    assert cookies[0]["domain"] == ".chatgpt.com"
    assert cookies[0]["path"] == "/"
    assert cookies[0]["expires"] == -1
    assert cookies[0]["secure"] is True
    assert cookies[0]["sameSite"] == "Lax"


def test_load_netscape_cookie_file(tmp_path):
    content = (
        "# Netscape HTTP Cookie File\n"
        ".chatgpt.com\tTRUE\t/\tTRUE\t-1\t__Secure-next-auth.session-token\ttok\n"
        ".chatgpt.com\tTRUE\t/\tTRUE\t0\tother\tval\n"
    )
    p = tmp_path / "cookies.txt"
    p.write_text(content, encoding="utf-8")

    cookies = load_cookie_file(p)
    assert len(cookies) == 2
    assert cookies[0]["name"] == SESSION_COOKIE
    assert cookies[0]["value"] == "tok"
    assert cookies[0]["domain"] == ".chatgpt.com"
    assert cookies[0]["expires"] == -1
    assert cookies[0]["secure"] is True
    assert cookies[1]["expires"] == 0


def test_load_netscape_bad_field_count_raises(tmp_path):
    p = tmp_path / "cookies.txt"
    p.write_text("only\tthree\tfields\n", encoding="utf-8")
    with pytest.raises(CookieFormatError):
        load_cookie_file(p)


def test_load_netscape_bad_expires_raises(tmp_path):
    p = tmp_path / "cookies.txt"
    p.write_text(
        ".chatgpt.com\tTRUE\t/\tTRUE\tnotanumber\tname\tvalue\n",
        encoding="utf-8",
    )
    with pytest.raises(CookieFormatError):
        load_cookie_file(p)


def test_load_json_bad_format_raises(tmp_path):
    p = tmp_path / "cookies.json"
    p.write_text("{not json", encoding="utf-8")
    with pytest.raises(CookieFormatError):
        load_cookie_file(p)


def test_load_json_non_array_raises(tmp_path):
    p = tmp_path / "cookies.json"
    p.write_text('{"name": "x"}', encoding="utf-8")
    with pytest.raises(CookieFormatError):
        load_cookie_file(p)


def test_load_json_cookie_missing_value_raises(tmp_path):
    p = tmp_path / "cookies.json"
    p.write_text('[{"name": "x"}]', encoding="utf-8")
    with pytest.raises(CookieFormatError):
        load_cookie_file(p)


# --- Chrome-extension (Cookie-Editor style) wrapper object support ---


def _chrome_cookie(
    name: str,
    value: str = "v",
    same_site: str = "lax",
    expiration_date: float | None = None,
    session: bool = False,
    host_only: bool = False,
    secure: bool = True,
) -> dict:
    c = {
        "domain": "chatgpt.com",
        "hostOnly": host_only,
        "httpOnly": True,
        "name": name,
        "path": "/",
        "sameSite": same_site,
        "secure": secure,
        "session": session,
        "storeId": "0",
        "value": value,
    }
    if expiration_date is not None:
        c["expirationDate"] = expiration_date
    return c


def test_load_wrapper_object_uses_cookies_list(tmp_path):
    raw = {
        "url": "https://chatgpt.com",
        "cookies": [
            _chrome_cookie(SESSION_COOKIE, "tok", expiration_date=float(int(time.time()) + 3600)),
            _chrome_cookie("other", "x", same_site="no_restriction"),
        ],
    }
    p = tmp_path / "cookies.txt"  # extension is .txt but content is JSON
    p.write_text(json.dumps(raw), encoding="utf-8")

    cookies = load_cookie_file(p)
    assert len(cookies) == 2
    assert cookies[0]["name"] == SESSION_COOKIE
    assert cookies[0]["domain"] == ".chatgpt.com"
    assert cookies[0]["expires"] > time.time()


def test_content_sniff_detects_json_in_txt(tmp_path):
    # Named .txt but JSON content -> must take the JSON path.
    raw = {"url": "https://chatgpt.com", "cookies": [_chrome_cookie("a", "b")]}
    p = tmp_path / "cookies.txt"
    p.write_text(json.dumps(raw), encoding="utf-8")

    cookies = load_cookie_file(p)
    assert cookies[0]["name"] == "a"
    assert cookies[0]["value"] == "b"


def test_expiration_date_converts_to_expires(tmp_path):
    exp = float(int(time.time()) + 5000)
    raw = {"url": "https://chatgpt.com", "cookies": [_chrome_cookie("a", "b", expiration_date=exp)]}
    p = tmp_path / "cookies.txt"
    p.write_text(json.dumps(raw), encoding="utf-8")

    cookies = load_cookie_file(p)
    assert cookies[0]["expires"] == exp


def test_expires_preferred_over_expiration_date(tmp_path):
    exp = float(int(time.time()) + 5000)
    raw = {
        "url": "https://chatgpt.com",
        "cookies": [
            {**_chrome_cookie("a", "b", expiration_date=exp), "expires": 123}
        ],
    }
    p = tmp_path / "cookies.txt"
    p.write_text(json.dumps(raw), encoding="utf-8")

    cookies = load_cookie_file(p)
    assert cookies[0]["expires"] == 123


def test_samesite_mapping(tmp_path):
    raw = {
        "url": "https://chatgpt.com",
        "cookies": [
            _chrome_cookie("lax", "1", same_site="lax"),
            _chrome_cookie("strict", "2", same_site="strict"),
            _chrome_cookie("none", "3", same_site="no_restriction"),
            _chrome_cookie("unspec", "4", same_site="unspecified"),
            _chrome_cookie("missing", "5"),  # no sameSite key
        ],
    }
    p = tmp_path / "cookies.txt"
    p.write_text(json.dumps(raw), encoding="utf-8")

    cookies = load_cookie_file(p)
    by_name = {c["name"]: c["sameSite"] for c in cookies}
    assert by_name["lax"] == "Lax"
    assert by_name["strict"] == "Strict"
    assert by_name["none"] == "None"
    assert by_name["unspec"] == "Lax"
    assert by_name["missing"] == "Lax"


def test_wrapper_object_without_cookies_raises(tmp_path):
    p = tmp_path / "cookies.txt"
    p.write_text('{"url": "https://chatgpt.com"}', encoding="utf-8")
    with pytest.raises(CookieFormatError):
        load_cookie_file(p)


def test_wrapper_object_cookies_valid_with_expiration_date(tmp_path):
    raw = {
        "url": "https://chatgpt.com",
        "cookies": [
            _chrome_cookie(SESSION_COOKIE, "tok", expiration_date=float(int(time.time()) + 3600))
        ],
    }
    p = tmp_path / "cookies.txt"
    p.write_text(json.dumps(raw), encoding="utf-8")

    cookies = load_cookie_file(p)
    assert cookies_valid(cookies) is True


# --- Chromium add_cookies-safe normalization ---


def _load_single(raw_cookie: dict, tmp_path) -> dict:
    raw = {"url": "https://chatgpt.com", "cookies": [raw_cookie]}
    p = tmp_path / "cookies.txt"
    p.write_text(json.dumps(raw), encoding="utf-8")
    return load_cookie_file(p)[0]


def test_host_only_cookie_uses_url_form_and_drops_domain(tmp_path):
    c = _load_single(_chrome_cookie("a", "b", host_only=True), tmp_path)
    assert "domain" not in c
    assert c["url"] == "https://chatgpt.com/"
    assert c["name"] == "a"
    assert c["value"] == "b"


def test_non_host_only_cookie_keeps_domain_form(tmp_path):
    c = _load_single(_chrome_cookie("a", "b", host_only=False), tmp_path)
    assert "url" not in c
    assert c["domain"] == ".chatgpt.com"


def test_float_expires_converted_to_int(tmp_path):
    exp = float(int(time.time()) + 5000)
    c = _load_single(_chrome_cookie("a", "b", expiration_date=exp), tmp_path)
    assert isinstance(c["expires"], int)
    assert c["expires"] == int(exp)


def test_samesite_none_insecure_downgraded_to_lax(tmp_path):
    c = _load_single(
        _chrome_cookie("a", "b", same_site="no_restriction", secure=False),
        tmp_path,
    )
    assert c["sameSite"] == "Lax"
    assert c["secure"] is False


def test_samesite_none_secure_kept_as_none(tmp_path):
    c = _load_single(
        _chrome_cookie("a", "b", same_site="no_restriction", secure=True),
        tmp_path,
    )
    assert c["sameSite"] == "None"
    assert c["secure"] is True
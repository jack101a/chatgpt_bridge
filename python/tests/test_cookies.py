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
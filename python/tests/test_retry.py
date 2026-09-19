"""Unit tests for retry classification/config (pure logic)."""

from __future__ import annotations

from chatgpt_bridge.errors import GenerationDeniedError
from chatgpt_bridge.retry import RetryConfig, classify_response, parse_rate_limit_wait


def test_denial():
    assert (
        classify_response(
            "I'm sorry, I can't create that image as it may violate content policy."
        )
        == "denial"
    )
    assert (
        classify_response(
            "I cannot fulfill this request as it goes against our community guidelines."
        )
        == "denial"
    )
    assert (
        classify_response(
            "I cannot generate images of this nature."
        )
        == "denial"
    )


def test_deterministic_ip():
    assert (
        classify_response(
            "This request is too similar to third-party content protected by copyright."
        )
        == "deterministic"
    )


def test_rate_limit():
    assert (
        classify_response("Rate limit reached — try again in 5 minutes.")
        == "rate_limit"
    )
    assert (
        classify_response(
            "I was unable to generate the image because image generation is temporarily rate-limited."
        )
        == "rate_limit"
    )
    assert (
        classify_response(
            "I couldn’t generate the image because the image-generation limit is temporarily active. Please try again in about 7 minutes."
        )
        == "rate_limit"
    )
    assert (
        classify_response(
            "I’m unable to generate the image right now because the image-generation rate limit has been reached."
        )
        == "rate_limit"
    )
    assert (
        classify_response(
            "You have reached your limit of images for now. Try again later."
        )
        == "rate_limit"
    )
    assert (
        classify_response(
            "You've reached your limit for sending messages to ChatGPT."
        )
        == "rate_limit"
    )


def test_generic_fail():
    assert (
        classify_response("Image generation failed. Something went wrong.")
        == "generic_fail"
    )


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


def test_denied_error_kind():
    err = GenerationDeniedError("denied", kind="deterministic")
    assert isinstance(err, RuntimeError)
    assert err.kind == "deterministic"


def test_standardize_image_prompt():
    from chatgpt_bridge.retry import standardize_image_prompt

    assert (
        standardize_image_prompt("a cute kitten in a teacup")
        == "a cute kitten in a teacup"
    )
    assert (
        standardize_image_prompt("generate image of a mountain sunset")
        == "a mountain sunset"
    )
    assert (
        standardize_image_prompt("Generate an image of a red racecar")
        == "a red racecar"
    )
    assert (
        standardize_image_prompt("Please generate image: cyberpunk cityscape")
        == "cyberpunk cityscape"
    )
    assert (
        standardize_image_prompt("create image - vintage portrait")
        == "vintage portrait"
    )
    # Annoying wrappers should be cleanly stripped to raw prompt
    assert (
        standardize_image_prompt("(Generate Image -\na blue ocean)")
        == "a blue ocean"
    )
    assert (
        standardize_image_prompt(
            "Please generate an image using the exact prompt below. Do not rewrite, expand, or alter this text; pass it verbatim to the dalle tool:\n\n\"A serene landscape\""
        )
        == "A serene landscape"
    )


def test_parse_rate_limit_info():
    from chatgpt_bridge.retry import parse_rate_limit_info

    info_hours = parse_rate_limit_info("You have reached your limit. Try again in 2 hours.")
    assert info_hours["wait_seconds"] == 7200.0
    assert info_hours["hours"] == 2.0

    info_mins = parse_rate_limit_info("Limit reached. Please try again in 30 minutes.")
    assert info_mins["wait_seconds"] == 1800.0
    assert info_mins["hours"] == 0.5

    # Fixed base timestamp for clock time parsing: 2026-09-13 14:00:00 (2 PM)
    base_ts = 1789286400.0  # arbitrary epoch
    info_time = parse_rate_limit_info("Try again after 6:30 PM", current_time=base_ts)
    assert info_time["resets_at"] > base_ts
    assert "resets_at_str" in info_time


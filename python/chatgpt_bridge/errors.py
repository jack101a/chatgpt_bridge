"""Exception types shared across chatgpt-bridge."""

from __future__ import annotations


class AuthError(RuntimeError):
    """Session is invalid; user must re-login or refresh cookies."""


class ShapeChangedError(RuntimeError):
    """The chatgpt.com HTTP/DOM shape drifted from what we expect.

    Internal signal that triggers the UI fallback path.
    """


class BridgeTimeoutError(TimeoutError):
    """An operation exceeded its configured time limit."""


class DaemonUnreachableError(RuntimeError):
    """The local daemon could not be reached or spawned."""


class GenerationDeniedError(RuntimeError):
    """Image generation was denied or retries were exhausted."""

    def __init__(self, message: str, kind: str = "unknown") -> None:
        super().__init__(message)
        self.kind = kind
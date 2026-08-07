"""Centralized structured logging for the AI service.

All modules obtain their logger via ``get_logger(__name__)`` so log records
share a consistent, machine-parsable JSON format and a single stdout handler.
``setup_logging()`` is called once at application startup (ASGI lifespan).

Each record is a single JSON object::

    {"ts": "...", "level": "info", "logger": "pnm-ai.main", "msg": "...",
     "request_id": "...", "meta": {...}}

The ``request_id`` is populated from the incoming ``x-request-id`` header
(via ``set_request_id``) so logs produced while servicing a request carry the
same correlation id the NestJS API emitted — enabling end-to-end tracing.
"""

import contextvars
import json
import logging
import sys
import time
from typing import Any, Optional

from app import config

ROOT_LOGGER_NAME = "pnm-ai"

# Per-request correlation id, populated by the ASGI app from x-request-id.
_REQUEST_ID: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    "request_id", default=None
)

# Sensitive keys (case-insensitive substring match) scrubbed from every record.
_SENSITIVE_KEYS = (
    "password",
    "passwd",
    "secret",
    "token",
    "authorization",
    "cookie",
    "api_key",
    "apikey",
    "client_secret",
    "private_key",
    "credential",
)

_configured = False


def set_request_id(request_id: Optional[str]) -> None:
    """Bind the current async context to a correlation id."""
    _REQUEST_ID.set(request_id)


def get_request_id() -> Optional[str]:
    return _REQUEST_ID.get()


def _redact(value: Any, depth: int = 0) -> Any:
    if depth > 8:
        return "[depth-limited]"
    if isinstance(value, str):
        return value
    if isinstance(value, (list, tuple)):
        return [_redact(v, depth + 1) for v in value]
    if isinstance(value, dict):
        out: dict = {}
        for key, val in value.items():
            k = str(key).lower()
            if any(pattern in k for pattern in _SENSITIVE_KEYS):
                out[key] = "[REDACTED]"
            else:
                out[key] = _redact(val, depth + 1)
        return out
    return value


class _JsonFormatter(logging.Formatter):
    """Emit one JSON object per record; falls back to safe scalars for odd values."""

    def __init__(self) -> None:
        super().__init__()
        # UTC timestamps in the JSON stream so logs sort correctly across hosts.
        self.converter = time.gmtime

    def format(self, record: logging.LogRecord) -> str:
        # Prefer the fully-formatted message so "%s" placeholders are resolved;
        # the raw format args are kept (redacted) in the structured "args" field.
        if record.args:
            try:
                msg = record.getMessage()
            except Exception:
                msg = str(record.msg) if isinstance(record.msg, str) else repr(record.msg)
            raw_args = record.args
        else:
            msg = (
                record.msg
                if isinstance(record.msg, (str, int, float, bool)) or record.msg is None
                else str(record.msg)
            )
            raw_args = None

        payload: dict[str, Any] = {
            "ts": self.formatTime(record, "%Y-%m-%dT%H:%M:%S") + "Z",
            "level": record.levelname.lower(),
            "logger": record.name,
            "msg": msg,
        }

        if raw_args is not None:
            payload["args"] = _redact(raw_args)

        request_id = _REQUEST_ID.get()
        if request_id:
            payload["request_id"] = request_id

        meta = getattr(record, "meta", None)
        if meta:
            payload["meta"] = _redact(meta)

        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)

        return json.dumps(payload, ensure_ascii=False, default=str)


class _PrettyFormatter(logging.Formatter):
    """Human-readable fallback (LOG_FORMAT=pretty) mirroring unit tests/dev."""

    COLORS = {
        logging.DEBUG: "\x1b[36m",
        logging.INFO: "\x1b[32m",
        logging.WARNING: "\x1b[33m",
        logging.ERROR: "\x1b[31m",
        logging.CRITICAL: "\x1b[35m",
    }

    def format(self, record: logging.LogRecord) -> str:
        color = self.COLORS.get(record.levelno, "")
        reset = "\x1b[0m"
        rid = _REQUEST_ID.get()
        suffix = f" [req={rid}]" if rid else ""
        return (
            f"{self.formatTime(record, '%Y-%m-%d %H:%M:%S')} "
            f"{color}{record.levelname:<5}{reset} {record.name}: "
            f"{record.getMessage()}{suffix}"
        )


def setup_logging() -> logging.Logger:
    """Configure the ``pnm-ai`` logger. Idempotent — safe to call repeatedly."""
    global _configured, _log_level

    root = logging.getLogger(ROOT_LOGGER_NAME)

    if _configured:
        return root

    level_name = getattr(config, "LOG_LEVEL", "INFO").upper()
    level = getattr(logging, level_name, logging.INFO)

    log_format = getattr(config, "LOG_FORMAT", "json").lower()
    formatter: logging.Formatter
    if log_format == "pretty":
        formatter = _PrettyFormatter()
    else:
        formatter = _JsonFormatter()

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)

    root.setLevel(level)
    root.handlers.clear()
    root.addHandler(handler)
    # Don't double-log through uvicorn's root handler.
    root.propagate = False

    # Silence noisy third-party loggers to debug/info level.
    for noisy in ("httpx", "httpcore", "crawl4ai", "openai"):
        try:
            logging.getLogger(noisy).setLevel(max(level, logging.WARNING))
        except Exception:
            pass

    _configured = True
    return root


def get_logger(name: str) -> logging.Logger:
    """Return a namespaced child of the ``pnm-ai`` logger."""
    if name.startswith("app."):
        name = name[len("app.") :]
    return logging.getLogger(f"{ROOT_LOGGER_NAME}.{name}")
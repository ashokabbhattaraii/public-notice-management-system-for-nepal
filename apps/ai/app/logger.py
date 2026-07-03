"""Centralized logging setup for the AI service.

All modules obtain their logger via ``get_logger(__name__)`` so log records
share a consistent format and a single stdout handler. ``setup_logging()`` is
called once at application startup (ASGI lifespan) to configure the root
``pnm-ai`` logger from ``LOG_LEVEL``.
"""

import logging
import sys

from app import config

ROOT_LOGGER_NAME = "pnm-ai"

_configured = False


def setup_logging() -> logging.Logger:
    """Configure the ``pnm-ai`` logger. Idempotent — safe to call repeatedly."""
    global _configured

    root = logging.getLogger(ROOT_LOGGER_NAME)

    if _configured:
        return root

    level = getattr(logging, config.LOG_LEVEL.upper(), logging.INFO)

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(
        logging.Formatter(
            fmt="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
    )

    root.setLevel(level)
    root.handlers.clear()
    root.addHandler(handler)
    # Don't double-log through uvicorn's root handler.
    root.propagate = False

    _configured = True
    return root


def get_logger(name: str) -> logging.Logger:
    """Return a namespaced child of the ``pnm-ai`` logger."""
    if name.startswith("app."):
        name = name[len("app.") :]
    return logging.getLogger(f"{ROOT_LOGGER_NAME}.{name}")

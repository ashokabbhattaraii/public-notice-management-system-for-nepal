"""Pulls admin-configured LLM API keys/models from apps/api and applies them
to this process, so an admin can rotate a key or switch models from
/admin/settings without a redeploy.

Deliberately pull-based (this service polls the API), not push-based — it's
the same pattern already used for `scraping.summarizeConcurrency`, just on a
timer instead of per-request, since these apply to every LLM call rather
than one scrape run. `config.py`'s module attributes (GROQ_API_KEY,
GEMINI_MODEL, etc.) are mutated in place: every other module reads them via
`config.GROQ_API_KEY` at call time, not a captured copy, so a live update
here takes effect on the very next LLM call with no other code changes.

A field is only overridden when apps/api reports it as actually configured
(non-null) — an admin who has only set a Gemini key must not accidentally
blank out a working Groq key that only exists as an env var here.
"""

import asyncio

import httpx

from app import config
from app.logger import get_logger

logger = get_logger(__name__)

_REFRESH_INTERVAL_SECONDS = 180
_ENDPOINT = "/internal/ai-config"


async def refresh_once() -> bool:
    """Fetch overrides and apply them. Returns True on a successful fetch
    (even if every field was null, i.e. nothing to override) so callers can
    log distinctly from a network/config failure."""
    if not config.INTERNAL_SERVICE_SECRET:
        return False

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{config.API_INTERNAL_URL.rstrip('/')}{_ENDPOINT}",
                headers={"x-internal-secret": config.INTERNAL_SERVICE_SECRET},
            )
    except httpx.HTTPError as e:
        logger.warning("AI config sync: request failed: %s", e)
        return False

    if response.status_code != 200:
        logger.warning(
            "AI config sync: API returned %d: %.200s",
            response.status_code,
            response.text,
        )
        return False

    try:
        data = response.json()
    except ValueError:
        logger.warning("AI config sync: response was not valid JSON")
        return False

    applied = []

    if data.get("geminiApiKey"):
        config.GEMINI_API_KEY = data["geminiApiKey"]
        applied.append("geminiApiKey")
    if data.get("geminiModel"):
        config.GEMINI_MODEL = data["geminiModel"]
        applied.append("geminiModel")

    if data.get("groqApiKey"):
        config.GROQ_API_KEY = data["groqApiKey"]
        # Admin sets one key via the UI (no rotation config there), so this
        # replaces the whole rotation list — an env-configured GROQ_API_KEYS
        # for multi-key rotation is a power-user path that only applies when
        # the admin hasn't overridden the key at all.
        config.GROQ_API_KEYS = [data["groqApiKey"]]
        applied.append("groqApiKey")
    if data.get("groqModel"):
        config.GROQ_MODEL = data["groqModel"]
        applied.append("groqModel")

    if data.get("openCodeZenApiKey"):
        config.OPENCODE_ZEN_API_KEY = data["openCodeZenApiKey"]
        applied.append("openCodeZenApiKey")
    if data.get("openCodeZenModel"):
        config.OPENCODE_ZEN_MODEL = data["openCodeZenModel"]
        applied.append("openCodeZenModel")

    priority = data.get("providerPriority")
    if priority:
        parsed = [p.strip() for p in str(priority).split(",") if p.strip()]
        if parsed:
            config.LLM_PROVIDER_PRIORITY = parsed
            applied.append(f"providerPriority({','.join(parsed)})")

    if applied:
        logger.info("AI config synced from admin settings: %s", ", ".join(applied))
    else:
        logger.debug("AI config sync: no admin overrides configured")
    return True


async def sync_loop() -> None:
    """Runs for the lifetime of the process — refreshes immediately, then on
    a fixed interval. Never raises: a single bad cycle (API briefly down)
    just leaves the current in-memory config in place until the next tick."""
    if not config.INTERNAL_SERVICE_SECRET:
        logger.info("AI config sync disabled (INTERNAL_SERVICE_SECRET not set)")
        return

    while True:
        try:
            await refresh_once()
        except Exception:
            logger.exception("AI config sync cycle crashed unexpectedly")
        await asyncio.sleep(_REFRESH_INTERVAL_SECONDS)

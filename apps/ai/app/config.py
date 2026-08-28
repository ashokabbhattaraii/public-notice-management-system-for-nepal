import os
from pathlib import Path

from dotenv import load_dotenv

# override=True so the .env file is authoritative in dev even if a stale value
# was already present in the process environment (e.g. across uvicorn reloads).
load_dotenv(Path(__file__).resolve().parent.parent / ".env", override=True)


def _env(key: str, default: str = "") -> str:
    return os.environ.get(key, default)


def _env_int(key: str, default: int = 0) -> int:
    val = os.environ.get(key)
    if val is None:
        return default
    return int(val)


PORT: int = _env_int("PORT", 8000)
ENVIRONMENT: str = _env("ENVIRONMENT", "development")
LOG_LEVEL: str = _env("LOG_LEVEL", "INFO")
# "json" (default) for one JSON record per line; "pretty" for human-readable dev output.
LOG_FORMAT: str = _env("LOG_FORMAT", "json")

EMBEDDING_MODEL: str = _env(
    "EMBEDDING_MODEL",
    "intfloat/multilingual-e5-base",
)
# Output dimension of EMBEDDING_MODEL. Must match the Qdrant collection's
# vector size. Change this if you switch to a model with a different dimension.
EMBEDDING_DIM: int = _env_int("EMBEDDING_DIM", 768)

# Hybrid retrieval: BM25 sparse vectors fused with dense vectors via RRF.
# Set HYBRID_SEARCH=false to fall back to dense-only search.
HYBRID_SEARCH: bool = _env("HYBRID_SEARCH", "true").lower() in ("1", "true", "yes")
SPARSE_MODEL: str = _env("SPARSE_MODEL", "Qdrant/bm25")

QDRANT_URL: str = _env("QDRANT_URL", "http://localhost:6333")
QDRANT_API_KEY: str = _env("QDRANT_API_KEY")
QDRANT_COLLECTION: str = _env("QDRANT_COLLECTION", "documents")

CHUNK_SIZE: int = _env_int("CHUNK_SIZE", 800)
CHUNK_OVERLAP: int = _env_int("CHUNK_OVERLAP", 120)

# Chunks embedded per model.encode() call; keeps memory bounded on large docs.
EMBEDDING_BATCH_SIZE: int = _env_int("EMBEDDING_BATCH_SIZE", 32)

# Admin-managed override sync (see app/ai_config_sync.py) — polls apps/api's
# encrypted settings store for admin-configured keys/models, mutating the
# module attributes below in place. Leave INTERNAL_SERVICE_SECRET empty to
# disable the sync entirely and run purely off this file's static values.
API_INTERNAL_URL: str = _env("API_INTERNAL_URL", "http://localhost:5005")
INTERNAL_SERVICE_SECRET: str = _env("INTERNAL_SERVICE_SECRET")

GROQ_API_KEY: str = _env("GROQ_API_KEY")
GROQ_API_KEYS: list[str] = [k.strip() for k in _env("GROQ_API_KEYS", "").split(",") if k.strip()] or ([GROQ_API_KEY] if GROQ_API_KEY else [])
# llama-3.3-70b-versatile was retired from Groq's catalog (404 model_not_found).
# gpt-oss-120b is the closest replacement in scale/quality.
GROQ_MODEL: str = _env("GROQ_MODEL", "openai/gpt-oss-120b")

GEMINI_API_KEY: str = _env("GEMINI_API_KEY")
# gemini-2.0-flash was retired; Google's own 404 response names the successor.
GEMINI_MODEL: str = _env("GEMINI_MODEL", "gemini-3.6-flash")

# OpenCode Zen — free-tier OpenAI-compatible chat completions gateway. Third
# fallback tier, tried after Gemini and Groq both fail (e.g. Gemini's billing
# is exhausted, or Groq is rate-limited across all rotated keys).
OPENCODE_ZEN_API_KEY: str = _env("OPENCODE_ZEN_API_KEY")
OPENCODE_ZEN_BASE_URL: str = _env("OPENCODE_ZEN_BASE_URL", "https://opencode.ai/zen/v1/chat/completions")
OPENCODE_ZEN_MODEL: str = _env("OPENCODE_ZEN_MODEL", "deepseek-v4-flash-free")

# Order in which LLM providers are tried; the first one that returns a
# non-empty answer wins. Providers omitted here are never called at all, which
# is how an admin disables one without deleting its key. Overridable live from
# the admin settings panel (see ai_config_sync.py) — this env value is only
# the fallback default.
LLM_PROVIDER_PRIORITY: list[str] = [
    p.strip() for p in _env("LLM_PROVIDER_PRIORITY", "gemini,groq,opencode").split(",") if p.strip()
]

# Retrieval tuning: hits scoring below the threshold are dropped from context.
# E5-family models compress cosine similarity into ~0.7-0.9; observed in
# practice: irrelevant hits ~0.76-0.78, relevant ~0.82+.
RAG_SCORE_THRESHOLD: float = float(_env("RAG_SCORE_THRESHOLD", "0.78"))

TESSERACT_LANG: str = _env("TESSERACT_LANG", "nep+eng")

# Process-wide cap on concurrent OCR jobs (Tesseract + page rendering), shared
# across every caller — document uploads AND scraping's per-notice PDF
# extraction. Each OCR job is already close to 100% CPU on its own; without
# this, concurrent scrape sources (each triggering their own OCR calls
# independently) stack multiple full-CPU Tesseract processes at once, which
# is what pegs/heats a dev machine and can look like a crash. Conservative
# default since the AI service usually runs on a small 2 vCPU box in prod.
OCR_MAX_CONCURRENCY: int = _env_int("OCR_MAX_CONCURRENCY", 1)

# Fallback default for max concurrent LLM summarization calls during a scrape
# run. The live value is the admin `scraping.summarizeConcurrency` setting,
# sent per-run by the API; this only applies when the API passes no value.
SUMMARIZE_CONCURRENCY: int = _env_int("SUMMARIZE_CONCURRENCY", 2)

UPLOAD_DIR: str = _env("UPLOAD_DIR", "./data/uploads")

# The live production domains are always allowed so a missing/stale
# CORS_ORIGINS in the deployed env can't break the browser app.
_PRODUCTION_ORIGINS = ["https://suchanaai.tech", "https://www.suchanaai.tech"]

CORS_ORIGINS: list[str] = list(
    dict.fromkeys(
        [
            o.strip()
            for o in _env(
                "CORS_ORIGINS", "http://localhost:3535,http://localhost:5005"
            ).split(",")
            if o.strip()
        ]
        + _PRODUCTION_ORIGINS
    )
)


def ensure_upload_dir() -> Path:
    path = Path(UPLOAD_DIR)
    path.mkdir(parents=True, exist_ok=True)
    return path

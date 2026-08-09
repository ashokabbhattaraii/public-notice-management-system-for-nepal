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

# OpenCode Zen — primary LLM provider (DeepSeek V4 Flash, generous free quota).
# Base URL isn't hardcoded since we don't want a guessed endpoint baked into
# the codebase; set it from your OpenCode Zen dashboard/docs.
OPENCODE_ZEN_API_KEY: str = _env("OPENCODE_ZEN_API_KEY")
OPENCODE_ZEN_BASE_URL: str = _env("OPENCODE_ZEN_BASE_URL")
OPENCODE_ZEN_MODEL: str = _env("OPENCODE_ZEN_MODEL", "deepseek-v4-flash")

GROQ_API_KEY: str = _env("GROQ_API_KEY")
GROQ_API_KEYS: list[str] = [k.strip() for k in _env("GROQ_API_KEYS", "").split(",") if k.strip()] or ([GROQ_API_KEY] if GROQ_API_KEY else [])
GROQ_MODEL: str = _env("GROQ_MODEL", "llama-3.3-70b-versatile")

GEMINI_API_KEY: str = _env("GEMINI_API_KEY")
GEMINI_MODEL: str = _env("GEMINI_MODEL", "gemini-2.0-flash")

# Retrieval tuning: hits scoring below the threshold are dropped from context.
# E5-family models compress cosine similarity into ~0.7-0.9; observed in
# practice: irrelevant hits ~0.76-0.78, relevant ~0.82+.
RAG_SCORE_THRESHOLD: float = float(_env("RAG_SCORE_THRESHOLD", "0.78"))


def _env_bool(key: str, default: bool) -> bool:
    val = os.environ.get(key)
    if val is None:
        return default
    return val.strip().lower() in ("1", "true", "yes", "on")


def _env_float(key: str, default: float) -> float:
    val = os.environ.get(key)
    if val is None:
        return default
    return float(val)


# --- Reranking -------------------------------------------------------------
# A cross-encoder reorders the retrieval shortlist before it becomes LLM
# context. bge-reranker-v2-m3 is multilingual, so it handles the Nepali /
# romanized-Nepali / English mix this portal sees. Adds ~150-400ms on CPU for a
# 20-passage shortlist; disable if that budget matters more than ordering.
RERANK_ENABLED: bool = _env_bool("RERANK_ENABLED", True)
RERANKER_MODEL: str = _env("RERANKER_MODEL", "BAAI/bge-reranker-v2-m3")
RERANK_BATCH_SIZE: int = _env_int("RERANK_BATCH_SIZE", 16)
# Shortlist size handed to the reranker. Larger recall is what makes reranking
# worthwhile, but cost is linear in this number.
RERANK_CANDIDATES: int = _env_int("RERANK_CANDIDATES", 20)

# --- Notice search ---------------------------------------------------------
# Vector hits below this are never considered, regardless of the relative
# cutoff below. Deliberately well under the old hard 0.75 gate, which silently
# discarded correct-but-loosely-phrased matches and produced "I couldn't find
# anything" for questions the corpus did answer.
NOTICE_SEARCH_MIN_SCORE: float = _env_float("NOTICE_SEARCH_MIN_SCORE", 0.62)
# Relative cutoff: drop hits scoring more than this far below the best hit.
# Scales with query difficulty instead of assuming a fixed absolute quality bar.
NOTICE_SEARCH_RELATIVE_MARGIN: float = _env_float("NOTICE_SEARCH_RELATIVE_MARGIN", 0.08)

TESSERACT_LANG: str = _env("TESSERACT_LANG", "nep+eng")

# Fallback default for max concurrent LLM summarization calls during a scrape
# run. The live value is the admin `scraping.summarizeConcurrency` setting,
# sent per-run by the API; this only applies when the API passes no value.
SUMMARIZE_CONCURRENCY: int = _env_int("SUMMARIZE_CONCURRENCY", 2)

UPLOAD_DIR: str = _env("UPLOAD_DIR", "./data/uploads")

CORS_ORIGINS: list[str] = [
    o.strip()
    for o in _env("CORS_ORIGINS", "http://localhost:3535,http://localhost:5005").split(",")
    if o.strip()
]


def ensure_upload_dir() -> Path:
    path = Path(UPLOAD_DIR)
    path.mkdir(parents=True, exist_ok=True)
    return path

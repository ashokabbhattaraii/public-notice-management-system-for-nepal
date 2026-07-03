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

GROQ_API_KEY: str = _env("GROQ_API_KEY")
GROQ_MODEL: str = _env("GROQ_MODEL", "llama-3.3-70b-versatile")

# Retrieval tuning: hits scoring below the threshold are dropped from context.
# E5-family models compress cosine similarity into ~0.7-0.9; observed in
# practice: irrelevant hits ~0.76-0.78, relevant ~0.82+.
RAG_SCORE_THRESHOLD: float = float(_env("RAG_SCORE_THRESHOLD", "0.78"))

TESSERACT_LANG: str = _env("TESSERACT_LANG", "nep+eng")

UPLOAD_DIR: str = _env("UPLOAD_DIR", "./data/uploads")

CORS_ORIGINS: list[str] = [
    o.strip()
    for o in _env("CORS_ORIGINS", "http://localhost:3000,http://localhost:5005").split(",")
    if o.strip()
]


def ensure_upload_dir() -> Path:
    path = Path(UPLOAD_DIR)
    path.mkdir(parents=True, exist_ok=True)
    return path

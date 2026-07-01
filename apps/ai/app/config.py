import os
from pathlib import Path


def _env(key: str, default: str = "") -> str:
    return os.environ.get(key, default)


def _env_int(key: str, default: int = 0) -> int:
    val = os.environ.get(key)
    if val is None:
        return default
    return int(val)


PORT: int = _env_int("PORT", 8000)
ENVIRONMENT: str = _env("ENVIRONMENT", "development")

EMBEDDING_MODEL: str = _env(
    "EMBEDDING_MODEL",
    "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
)

QDRANT_URL: str = _env("QDRANT_URL", "http://localhost:6333")
QDRANT_COLLECTION: str = _env("QDRANT_COLLECTION", "documents")

CHUNK_SIZE: int = _env_int("CHUNK_SIZE", 512)
CHUNK_OVERLAP: int = _env_int("CHUNK_OVERLAP", 50)

GROQ_API_KEY: str = _env("GROQ_API_KEY")

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

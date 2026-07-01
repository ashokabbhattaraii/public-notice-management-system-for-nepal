from typing import Optional

from app import config

_model: Optional[object] = None


def _load_model():
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer

        _model = SentenceTransformer(config.EMBEDDING_MODEL)
    return _model


def is_loaded() -> bool:
    return _model is not None


def get_embeddings(texts: list[str]) -> list[list[float]]:
    model = _load_model()
    embeddings = model.encode(texts, normalize_embeddings=True)
    return embeddings.tolist()


def get_embedding(text: str) -> list[float]:
    results = get_embeddings([text])
    return results[0]

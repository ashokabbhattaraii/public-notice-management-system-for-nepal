from typing import Optional
import uuid

from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    FieldCondition,
    Filter,
    MatchValue,
    PointStruct,
    VectorParams,
)

from app import config

_client: Optional[QdrantClient] = None


def get_client() -> QdrantClient:
    global _client
    if _client is None:
        _client = QdrantClient(url=config.QDRANT_URL)
    return _client


def is_connected() -> bool:
    try:
        client = get_client()
        client.get_collections()
        return True
    except Exception:
        return False


def ensure_collection() -> None:
    client = get_client()
    collections = client.get_collections().collections
    names = [c.name for c in collections]

    if config.QDRANT_COLLECTION not in names:
        client.create_collection(
            collection_name=config.QDRANT_COLLECTION,
            vectors_config=VectorParams(size=384, distance=Distance.COSINE),
        )


def index_document(
    doc_id: str,
    chunks: list[dict],
    embeddings: list[list[float]],
    metadata: dict,
) -> int:
    client = get_client()
    ensure_collection()

    points: list[PointStruct] = []
    for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
        point_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{doc_id}:{i}"))
        payload = {
            "doc_id": doc_id,
            "chunk_index": i,
            "content": chunk["content"],
            "char_start": chunk["char_start"],
            "char_end": chunk["char_end"],
            **metadata,
        }
        points.append(PointStruct(id=point_id, vector=embedding, payload=payload))

    batch_size = 100
    for start in range(0, len(points), batch_size):
        batch = points[start : start + batch_size]
        client.upsert(collection_name=config.QDRANT_COLLECTION, points=batch)

    return len(points)


def search(
    query_embedding: list[float],
    top_k: int = 5,
    filter_doc_id: Optional[str] = None,
) -> list[dict]:
    client = get_client()

    query_filter = None
    if filter_doc_id:
        query_filter = Filter(
            must=[FieldCondition(key="doc_id", match=MatchValue(value=filter_doc_id))]
        )

    results = client.query_points(
        collection_name=config.QDRANT_COLLECTION,
        query=query_embedding,
        query_filter=query_filter,
        limit=top_k,
    )

    output: list[dict] = []
    for point in results.points:
        output.append(
            {
                "content": point.payload.get("content", ""),
                "score": point.score,
                "doc_id": point.payload.get("doc_id", ""),
                "chunk_index": point.payload.get("chunk_index", 0),
                "metadata": {
                    k: v
                    for k, v in point.payload.items()
                    if k not in ("content", "doc_id", "chunk_index", "char_start", "char_end")
                },
            }
        )

    return output


def delete_document(doc_id: str) -> bool:
    client = get_client()
    client.delete(
        collection_name=config.QDRANT_COLLECTION,
        points_selector=Filter(
            must=[FieldCondition(key="doc_id", match=MatchValue(value=doc_id))]
        ),
    )
    return True


def get_document_chunks(doc_id: str) -> int:
    client = get_client()
    result = client.count(
        collection_name=config.QDRANT_COLLECTION,
        count_filter=Filter(
            must=[FieldCondition(key="doc_id", match=MatchValue(value=doc_id))]
        ),
    )
    return result.count

import json
import re
import uuid
from pathlib import Path
from typing import Optional

from app import config
from app import chunker
from app import embeddings
from app import extractor
from app import rag
from app import store


async def app(scope, receive, send):
    if scope["type"] == "lifespan":
        await _handle_lifespan(scope, receive, send)
        return

    if scope["type"] != "http":
        return

    method = scope["method"]
    path = scope["path"]

    if method == "OPTIONS":
        await _cors_preflight(send, scope)
        return

    try:
        response = await _route(method, path, scope, receive)
    except Exception as e:
        response = (500, {"error": "Internal server error", "detail": str(e)})

    status, body = response
    await _send_json(send, body, status, scope)


async def _handle_lifespan(scope, receive, send):
    while True:
        message = await receive()
        if message["type"] == "lifespan.startup":
            config.ensure_upload_dir()
            try:
                store.ensure_collection()
            except Exception:
                pass
            await send({"type": "lifespan.startup.complete"})
        elif message["type"] == "lifespan.shutdown":
            await send({"type": "lifespan.shutdown.complete"})
            return


async def _route(method: str, path: str, scope: dict, receive) -> tuple[int, dict]:
    if method == "GET" and path == "/":
        return 200, {"service": "pnm-ai", "status": "running", "version": "1.0.0"}

    if method == "GET" and path == "/health":
        return await _health()

    if method == "POST" and path == "/documents":
        return await _upload_document(scope, receive)

    doc_status_match = re.match(r"^/documents/([^/]+)/status$", path)
    if method == "GET" and doc_status_match:
        doc_id = doc_status_match.group(1)
        return await _document_status(doc_id)

    doc_delete_match = re.match(r"^/documents/([^/]+)$", path)
    if method == "DELETE" and doc_delete_match:
        doc_id = doc_delete_match.group(1)
        return await _delete_document(doc_id)

    if method == "POST" and path == "/query":
        return await _query(receive)

    return 404, {"error": "Not found"}


async def _health() -> tuple[int, dict]:
    qdrant_ok = False
    try:
        qdrant_ok = store.is_connected()
    except Exception:
        pass

    return 200, {
        "status": "ok",
        "qdrant": qdrant_ok,
        "model_loaded": embeddings.is_loaded(),
    }


async def _upload_document(scope: dict, receive) -> tuple[int, dict]:
    content_type = _get_header(scope, b"content-type")
    if not content_type or b"multipart/form-data" not in content_type:
        return 400, {"error": "Content-Type must be multipart/form-data"}

    boundary = _extract_boundary(content_type)
    if not boundary:
        return 400, {"error": "Missing multipart boundary"}

    body = await _read_body(receive)
    parts = _parse_multipart(body, boundary)

    file_part = parts.get("file")
    if not file_part:
        return 400, {"error": "No file uploaded. Field name must be 'file'"}

    metadata_raw = parts.get("metadata")
    metadata: dict = {}
    if metadata_raw:
        try:
            metadata = json.loads(metadata_raw["data"].decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError):
            pass

    filename = file_part.get("filename", "unknown")
    mime_type = file_part.get("content_type", "application/octet-stream")
    file_data = file_part["data"]

    doc_id_part = parts.get("document_id")
    if doc_id_part and doc_id_part["data"].strip():
        doc_id = doc_id_part["data"].decode("utf-8").strip()
    else:
        doc_id = str(uuid.uuid4())

    title_part = parts.get("title")
    if title_part and title_part["data"].strip():
        metadata["title"] = title_part["data"].decode("utf-8").strip()
    upload_dir = config.ensure_upload_dir()
    ext = Path(filename).suffix
    save_path = upload_dir / f"{doc_id}{ext}"
    save_path.write_bytes(file_data)

    try:
        result = extractor.extract_text(str(save_path), mime_type)
    except Exception as e:
        save_path.unlink(missing_ok=True)
        return 422, {"error": f"Text extraction failed: {str(e)}"}

    text = result["text"]
    if not text.strip():
        save_path.unlink(missing_ok=True)
        return 422, {"error": "No text could be extracted from the document"}

    chunks = chunker.chunk_text(text, config.CHUNK_SIZE, config.CHUNK_OVERLAP)

    chunk_texts = [c["content"] for c in chunks]
    chunk_embeddings = embeddings.get_embeddings(chunk_texts)

    doc_metadata = {
        "original_filename": filename,
        "mime_type": mime_type,
        **metadata,
    }

    try:
        chunk_count = store.index_document(doc_id, chunks, chunk_embeddings, doc_metadata)
    except Exception as e:
        save_path.unlink(missing_ok=True)
        return 503, {"error": f"Failed to index document: {str(e)}"}

    return 201, {
        "doc_id": doc_id,
        "text_length": len(text),
        "chunk_count": chunk_count,
        "is_ocr": result["is_ocr"],
        "page_count": result["page_count"],
        "filename": filename,
    }


async def _document_status(doc_id: str) -> tuple[int, dict]:
    try:
        chunk_count = store.get_document_chunks(doc_id)
        return 200, {
            "doc_id": doc_id,
            "chunk_count": chunk_count,
            "indexed": chunk_count > 0,
        }
    except Exception as e:
        return 503, {"error": f"Could not check document status: {str(e)}"}


async def _delete_document(doc_id: str) -> tuple[int, dict]:
    try:
        store.delete_document(doc_id)
        return 200, {"doc_id": doc_id, "deleted": True}
    except Exception as e:
        return 503, {"error": f"Failed to delete document: {str(e)}"}


async def _query(receive) -> tuple[int, dict]:
    body = await _read_body(receive)
    try:
        data = json.loads(body) if body else {}
    except json.JSONDecodeError:
        return 400, {"error": "Invalid JSON body"}

    question = data.get("question", "").strip()
    if not question:
        return 400, {"error": "Field 'question' is required"}

    doc_id = data.get("doc_id")
    top_k = data.get("top_k", 5)
    language = data.get("language", "en")

    try:
        result = await rag.query(
            question=question,
            doc_id=doc_id,
            top_k=top_k,
            language=language,
        )
        return 200, result
    except Exception as e:
        return 500, {"error": f"Query failed: {str(e)}"}


# --- HTTP helpers ---


async def _read_body(receive) -> bytes:
    body = b""
    while True:
        message = await receive()
        body += message.get("body", b"")
        if not message.get("more_body", False):
            break
    return body


def _get_header(scope: dict, name: bytes) -> Optional[bytes]:
    for header_name, header_value in scope.get("headers", []):
        if header_name.lower() == name.lower():
            return header_value
    return None


def _extract_boundary(content_type: bytes) -> Optional[bytes]:
    parts = content_type.split(b";")
    for part in parts:
        part = part.strip()
        if part.startswith(b"boundary="):
            boundary = part[9:]
            if boundary.startswith(b'"') and boundary.endswith(b'"'):
                boundary = boundary[1:-1]
            return boundary
    return None


def _parse_multipart(body: bytes, boundary: bytes) -> dict:
    parts: dict = {}
    delimiter = b"--" + boundary

    sections = body.split(delimiter)

    for section in sections:
        if not section or section.strip() == b"--" or section == b"\r\n":
            continue
        if section.startswith(b"--"):
            continue

        if b"\r\n\r\n" in section:
            header_part, data = section.split(b"\r\n\r\n", 1)
        elif b"\n\n" in section:
            header_part, data = section.split(b"\n\n", 1)
        else:
            continue

        if data.endswith(b"\r\n"):
            data = data[:-2]
        elif data.endswith(b"\n"):
            data = data[:-1]

        headers_str = header_part.decode("utf-8", errors="replace")
        field_name = None
        filename = None
        content_type = "application/octet-stream"

        for line in headers_str.split("\r\n"):
            if not line.strip():
                continue
            line_lower = line.lower()
            if "content-disposition" in line_lower:
                name_match = re.search(r'name="([^"]*)"', line)
                if name_match:
                    field_name = name_match.group(1)
                fname_match = re.search(r'filename="([^"]*)"', line)
                if fname_match:
                    filename = fname_match.group(1)
            elif "content-type" in line_lower:
                content_type = line.split(":", 1)[1].strip()

        if field_name:
            parts[field_name] = {
                "data": data,
                "filename": filename,
                "content_type": content_type,
            }

    return parts


def _get_cors_headers(scope: dict) -> list[list[bytes]]:
    origin = _get_header(scope, b"origin")
    allowed_origin = b"*"

    if origin:
        origin_str = origin.decode("utf-8", errors="replace")
        if origin_str in config.CORS_ORIGINS:
            allowed_origin = origin
        elif "*" in config.CORS_ORIGINS:
            allowed_origin = b"*"
        else:
            allowed_origin = origin

    return [
        [b"access-control-allow-origin", allowed_origin],
        [b"access-control-allow-methods", b"GET, POST, DELETE, OPTIONS"],
        [b"access-control-allow-headers", b"content-type, authorization"],
        [b"access-control-max-age", b"86400"],
    ]


async def _cors_preflight(send, scope: dict):
    cors_headers = _get_cors_headers(scope)
    await send({
        "type": "http.response.start",
        "status": 204,
        "headers": cors_headers,
    })
    await send({"type": "http.response.body", "body": b""})


async def _send_json(send, data: dict, status: int = 200, scope: dict = None):
    body = json.dumps(data, ensure_ascii=False).encode("utf-8")
    cors_headers = _get_cors_headers(scope) if scope else [
        [b"access-control-allow-origin", b"*"],
    ]
    headers = [
        [b"content-type", b"application/json; charset=utf-8"],
        [b"content-length", str(len(body)).encode()],
    ] + cors_headers

    await send({
        "type": "http.response.start",
        "status": status,
        "headers": headers,
    })
    await send({"type": "http.response.body", "body": body})

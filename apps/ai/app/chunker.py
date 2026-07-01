import re


def chunk_text(
    text: str, chunk_size: int = 512, overlap: int = 50
) -> list[dict]:
    if not text.strip():
        return []

    paragraphs = re.split(r"\n\s*\n", text)
    paragraphs = [p.strip() for p in paragraphs if p.strip()]

    segments: list[str] = []
    for para in paragraphs:
        if len(para) <= chunk_size:
            segments.append(para)
        else:
            segments.extend(_split_paragraph(para, chunk_size))

    chunks: list[dict] = []
    current = ""
    char_offset = 0

    for segment in segments:
        if not current:
            current = segment
        elif len(current) + len(segment) + 1 <= chunk_size:
            current = current + "\n" + segment
        else:
            chunks.append(_make_chunk(current, len(chunks), char_offset))
            char_offset += len(current) - overlap
            if overlap > 0 and len(current) > overlap:
                current = current[-overlap:] + "\n" + segment
            else:
                current = segment

    if current.strip():
        chunks.append(_make_chunk(current, len(chunks), char_offset))

    return chunks


def _split_paragraph(text: str, chunk_size: int) -> list[str]:
    sentences = re.split(r"(?<=[.!?।])\s+", text)
    segments: list[str] = []
    current = ""

    for sentence in sentences:
        if len(sentence) > chunk_size:
            if current:
                segments.append(current)
                current = ""
            segments.extend(_split_by_words(sentence, chunk_size))
        elif len(current) + len(sentence) + 1 <= chunk_size:
            current = (current + " " + sentence).strip()
        else:
            if current:
                segments.append(current)
            current = sentence

    if current:
        segments.append(current)

    return segments


def _split_by_words(text: str, chunk_size: int) -> list[str]:
    words = text.split()
    segments: list[str] = []
    current = ""

    for word in words:
        if len(current) + len(word) + 1 <= chunk_size:
            current = (current + " " + word).strip()
        else:
            if current:
                segments.append(current)
            current = word

    if current:
        segments.append(current)

    return segments


def _make_chunk(content: str, index: int, char_start: int) -> dict:
    return {
        "content": content,
        "index": index,
        "char_start": char_start,
        "char_end": char_start + len(content),
    }

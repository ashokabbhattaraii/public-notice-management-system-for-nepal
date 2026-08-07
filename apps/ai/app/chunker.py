"""Structure-aware text chunking with header hierarchy, tables, and page awareness.

Pipeline:
1. Parse text into structured blocks (headers, paragraphs, tables, code blocks)
2. Track header hierarchy to build section paths
3. Chunk within sections, preserving section path + header level per chunk
4. Preserve page metadata from PDF extraction
5. Output chunks with rich metadata: section_path, header_level, page_num, block_type
"""

import re
from dataclasses import dataclass, field
from typing import Optional

from app.logger import get_logger

logger = get_logger(__name__)


@dataclass
class Block:
    """A structural block of text with metadata."""
    content: str
    block_type: str  # "header", "paragraph", "table", "code", "list"
    level: int = 0  # header level (1-6), 0 for non-headers
    page_num: Optional[int] = None
    char_start: int = 0
    char_end: int = 0
    metadata: dict = field(default_factory=dict)


@dataclass
class Chunk:
    """A chunk with rich structural metadata."""
    content: str
    index: int
    char_start: int
    char_end: int
    section_path: str = ""  # e.g., "Introduction > Background > Methods"
    header_level: int = 0   # deepest header level in this chunk
    page_num: Optional[int] = None
    block_types: list[str] = field(default_factory=list)
    metadata: dict = field(default_factory=dict)


# Regex patterns for structure detection
HEADER_RE = re.compile(r"^(#{1,6})\s+(.+)$", re.MULTILINE)
TABLE_RE = re.compile(r"^\|.+\|$", re.MULTILINE)
CODE_FENCE_RE = re.compile(r"^```(\w*)\n(.*?)\n```", re.MULTILINE | re.DOTALL)
LIST_ITEM_RE = re.compile(r"^(\s*)[-*+]\s+", re.MULTILINE)
ORDERED_LIST_RE = re.compile(r"^(\s*)\d+\.\s+", re.MULTILINE)
PAGE_BREAK_RE = re.compile(r"\n\n---PAGE\s+(\d+)---\n\n")  # injected by PDF extractor


def parse_blocks(text: str, page_num: Optional[int] = None) -> list[Block]:
    """
    Parse text into structural blocks with hierarchy awareness.

    Handles:
    - Markdown headers (# ## ###)
    - Tables (| col | col |)
    - Code fences (```lang\ncode\n```)
    - Lists (bulleted and numbered)
    - Page breaks (---PAGE N---)
    """
    if not text.strip():
        return []

    blocks: list[Block] = []
    char_pos = 0

    # First, split by page breaks if present
    page_parts = PAGE_BREAK_RE.split(text)
    if len(page_parts) > 1:
        # Alternating: content, page_num, content, page_num...
        current_page = page_num or 1
        for i, part in enumerate(page_parts):
            if i % 2 == 0:
                # Content
                sub_blocks = _parse_blocks_single_page(part, current_page)
                for b in sub_blocks:
                    b.char_start += char_pos
                    b.char_end += char_pos
                blocks.extend(sub_blocks)
                char_pos += len(part)
            else:
                # Page number
                try:
                    current_page = int(part.strip())
                except ValueError:
                    pass
        return blocks

    # No page breaks - parse as single page
    return _parse_blocks_single_page(text, page_num or 1)


def _parse_blocks_single_page(text: str, page_num: int) -> list[Block]:
    """Parse a single page's text into blocks."""
    blocks: list[Block] = []
    char_pos = 0

    # Find all structural elements with their positions
    elements: list[tuple[int, int, str, str]] = []  # (start, end, type, content)

    # Headers
    for m in HEADER_RE.finditer(text):
        level = len(m.group(1))
        content = m.group(2).strip()
        elements.append((m.start(), m.end(), f"header_h{level}", content))

    # Tables (consecutive table rows)
    table_matches = list(TABLE_RE.finditer(text))
    if table_matches:
        # Group consecutive table rows
        table_groups = []
        current_group = []
        for m in table_matches:
            if not current_group or m.start() == current_group[-1].end() + 1 or text[current_group[-1].end():m.start()].strip() == "":
                current_group.append(m)
            else:
                table_groups.append(current_group)
                current_group = [m]
        if current_group:
            table_groups.append(current_group)

        for group in table_groups:
            start = group[0].start()
            end = group[-1].end()
            content = text[start:end]
            elements.append((start, end, "table", content))

    # Code fences
    for m in CODE_FENCE_RE.finditer(text):
        lang = m.group(1) or ""
        content = m.group(2)
        elements.append((m.start(), m.end(), f"code_{lang}", content))

    # Sort elements by position
    elements.sort(key=lambda x: x[0])

    # Now build blocks: elements + paragraphs between them
    last_end = 0
    for start, end, btype, content in elements:
        # Paragraph before this element
        if start > last_end:
            para_text = text[last_end:start].strip()
            if para_text:
                blocks.append(Block(
                    content=para_text,
                    block_type="paragraph",
                    page_num=None,
                    char_start=last_end,
                    char_end=start,
                ))
        # The element itself
        level = 0
        if btype.startswith("header_h"):
            try:
                level = int(btype.split("_")[-1])
            except (ValueError, IndexError):
                level = 0
        blocks.append(Block(
            content=content,
            block_type=btype,
            level=level,
            page_num=None,
            char_start=start,
            char_end=end,
            metadata={"raw_type": btype} if btype.startswith("header") else {}
        ))
        last_end = end

    # Trailing paragraph
    if last_end < len(text):
        para_text = text[last_end:].strip()
        if para_text:
            blocks.append(Block(
                content=para_text,
                block_type="paragraph",
                page_num=None,
                char_start=last_end,
                char_end=len(text),
            ))

    # Post-process: merge consecutive list items into list blocks
    return _merge_list_blocks(blocks)


def _merge_list_blocks(blocks: list[Block]) -> list[Block]:
    """Merge consecutive list items into single list blocks."""
    if not blocks:
        return blocks

    merged: list[Block] = []
    current_list: list[Block] = []

    for block in blocks:
        is_list_item = (
            block.block_type == "paragraph"
            and (LIST_ITEM_RE.match(block.content) or ORDERED_LIST_RE.match(block.content))
        )

        if is_list_item:
            current_list.append(block)
        else:
            if current_list:
                # Merge list items
                merged_content = "\n".join(b.content for b in current_list)
                merged.append(Block(
                    content=merged_content,
                    block_type="list",
                    level=0,
                    page_num=current_list[0].page_num,
                    char_start=current_list[0].char_start,
                    char_end=current_list[-1].char_end,
                ))
                current_list = []
            merged.append(block)

    if current_list:
        merged_content = "\n".join(b.content for b in current_list)
        merged.append(Block(
            content=merged_content,
            block_type="list",
            level=0,
            page_num=current_list[0].page_num,
            char_start=current_list[0].char_start,
            char_end=current_list[-1].char_end,
        ))

    return merged


def chunk_blocks(
    blocks: list[Block],
    chunk_size: int = 512,
    overlap: int = 50,
    max_chunks: Optional[int] = None,
) -> list[Chunk]:
    """
    Chunk blocks into size-bounded chunks with structural metadata.

    Strategy:
    1. Build section paths from header hierarchy
    2. Process blocks in order, accumulating into chunks
    3. When chunk would exceed size, finalize and start new with overlap
    4. Preserve section_path, header_level, page_num per chunk
    """
    if not blocks:
        return []

    # Build section paths from headers
    _build_section_paths(blocks)

    chunks: list[Chunk] = []
    current_content = ""
    current_blocks: list[Block] = []
    current_section_path = ""
    current_max_level = 0
    current_page: Optional[int] = None
    char_offset = 0
    overlap_text = ""

    for block in blocks:
        block_text = block.content

        # Check if adding this block would exceed chunk size
        would_exceed = len(current_content) + len(block_text) + 1 > chunk_size

        if would_exceed and current_content:
            # Finalize current chunk
            chunk = _finalize_chunk(
                current_content,
                current_blocks,
                len(chunks),
                char_offset,
                current_section_path,
                current_max_level,
                current_page,
            )
            chunks.append(chunk)

            # Start new chunk with overlap
            if overlap > 0 and overlap_text:
                current_content = overlap_text + "\n" + block.content
                char_offset = chunk.char_end - len(overlap_text)
            else:
                current_content = block.content
                char_offset = block.char_start

            current_blocks = [block]
            current_section_path = block.metadata.get("section_path", "")
            current_max_level = block.level if block.block_type.startswith("header") else 0
            current_page = block.page_num

        else:
            # Add to current chunk
            if current_content:
                current_content += "\n" + block.content
            else:
                current_content = block.content
            current_blocks.append(block)
            # Update section path from block metadata
            if block.metadata.get("section_path"):
                current_section_path = block.metadata.get("section_path", current_section_path)
            # Track max header level in this chunk
            if block.block_type.startswith("header"):
                current_max_level = max(current_max_level, block.level)
            if block.page_num is not None:
                current_page = block.page_num

        # Track overlap text (last `overlap` chars of current content)
        if len(current_content) > overlap:
            overlap_text = current_content[-overlap:]
            # Snap to word boundary
            boundary = overlap_text.find(" ")
            if boundary != -1:
                overlap_text = overlap_text[boundary + 1:]

        if max_chunks and len(chunks) >= max_chunks:
            break

    # Finalize last chunk
    if current_content:
        chunk = _finalize_chunk(
            current_content,
            current_blocks,
            len(chunks),
            char_offset,
            current_section_path,
            current_max_level,
            current_page,
        )
        chunks.append(chunk)

    return chunks


def _build_section_paths(blocks: list[Block]) -> None:
    """Build section_path metadata for each block from header hierarchy."""
    header_stack: list[tuple[int, str]] = []  # (level, title)

    for block in blocks:
        if block.block_type.startswith("header"):
            level = block.level
            title = block.content
            # Pop headers of same or higher level
            while header_stack and header_stack[-1][0] >= level:
                header_stack.pop()
            header_stack.append((level, title))
            block.metadata["section_path"] = " > ".join(t for _, t in header_stack)
            block.metadata["header_level"] = level
        else:
            # Inherit section path from nearest preceding header
            path = " > ".join(t for _, t in header_stack) if header_stack else ""
            block.metadata["section_path"] = path
            block.metadata["header_level"] = header_stack[-1][0] if header_stack else 0


def _finalize_chunk(
    content: str,
    blocks: list[Block],
    index: int,
    char_offset: int,
    section_path: str,
    max_level: int,
    page_num: Optional[int],
) -> Chunk:
    """Create a Chunk from accumulated content and blocks."""
    block_types = list(set(b.block_type for b in blocks))
    # Determine page from blocks
    chunk_page = page_num
    if chunk_page is None:
        for b in blocks:
            if b.page_num is not None:
                chunk_page = b.page_num
                break

    chunk = Chunk(
        content=content.strip(),
        index=len(chunks) if 'chunks' in locals() else 0,  # placeholder
        char_start=char_offset,
        char_end=char_offset + len(content),
        section_path=section_path,
        header_level=max_level,
        page_num=chunk_page,
        block_types=block_types,
        metadata={
            "block_count": len(blocks),
            "has_table": "table" in block_types,
            "has_code": any(b.startswith("code_") for b in block_types),
            "has_list": "list" in block_types,
        },
    )
    return chunk


def chunk_text(
    text: str,
    chunk_size: int = 512,
    overlap: int = 50,
    page_num: Optional[int] = None,
) -> list[dict]:
    """
    Main entry point: parse text into structure-aware chunks.

    Args:
        text: Raw text to chunk
        chunk_size: Target characters per chunk
        overlap: Overlap characters between chunks
        page_num: Optional page number (for PDF sources)

    Returns:
        List of chunk dicts with structural metadata
    """
    if not text.strip():
        return []

    # Parse into structural blocks
    blocks = parse_blocks(text, page_num)

    # Chunk with structure awareness
    chunks = chunk_blocks(blocks, chunk_size, overlap)

    # Convert to dict format for downstream
    result = []
    for i, chunk in enumerate(chunks):
        chunk.index = i
        result.append({
            "content": chunk.content,
            "index": chunk.index,
            "char_start": chunk.char_start,
            "char_end": chunk.char_end,
            "section_path": chunk.section_path,
            "header_level": chunk.header_level,
            "page_num": chunk.page_num,
            "block_types": chunk.block_types,
            "metadata": chunk.metadata,
        })

    sizes = [len(c["content"]) for c in result]
    logger.info(
        "Chunked %d chars into %d chunks (chunk_size=%d, overlap=%d, "
        "min=%d, avg=%d, max=%d chars/chunk)",
        len(text),
        len(result),
        chunk_size,
        overlap,
        min(sizes) if sizes else 0,
        sum(sizes) // len(sizes) if sizes else 0,
        max(sizes) if sizes else 0,
    )
    return result


# Backward compatibility wrapper
def chunk_text_simple(
    text: str, chunk_size: int = 512, overlap: int = 50
) -> list[dict]:
    """Legacy simple chunking for backward compatibility."""
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
            chunks.append(_make_chunk_simple(current, len(chunks), char_offset))
            char_offset += len(current) - overlap
            if overlap > 0 and len(current) > overlap:
                tail = current[-overlap:]
                boundary = tail.find(" ")
                if boundary != -1:
                    tail = tail[boundary + 1 :]
                current = (tail + "\n" + segment) if tail else segment
            else:
                current = segment

    if current.strip():
        chunks.append(_make_chunk_simple(current, len(chunks), char_offset))

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


def _make_chunk_simple(content: str, index: int, char_start: int) -> dict:
    return {
        "content": content,
        "index": index,
        "char_start": char_start,
        "char_end": char_start + len(content),
    }
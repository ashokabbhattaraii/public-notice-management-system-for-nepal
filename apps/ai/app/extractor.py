"""Document text extraction with intelligent Unicode validation and OCR fallback.

Pipeline:
1. Extract text via native parsers (pypdf, python-docx, etc.)
2. Validate extracted text for Unicode quality (detects legacy font encodings)
3. If text fails validation → OCR the rendered pages (handles ALL legacy fonts)
4. Final cleanup and normalization

This approach handles Preeti, Kantipur, PCS Nepali, Sagarmatha, Himalb, and any
other legacy Nepali font without needing per-font character maps — OCR reads the
rendered glyphs, producing correct Unicode regardless of the underlying encoding.
"""

import re
import shutil
from pathlib import Path

from app import config
from app.logger import get_logger

logger = get_logger(__name__)

_DEVANAGARI_RE = re.compile(r"[ऀ-ॿ]")
_ASCII_ALPHA_RE = re.compile(r"[a-zA-Z]")
_LEGACY_FONT_INDICATORS = set("{}[]|\\;+=/")

_TESSERACT_AVAILABLE: bool | None = None


def _check_tesseract() -> bool:
    """Check if Tesseract OCR is available on this system."""
    global _TESSERACT_AVAILABLE
    if _TESSERACT_AVAILABLE is None:
        _TESSERACT_AVAILABLE = shutil.which("tesseract") is not None
        if _TESSERACT_AVAILABLE:
            logger.info("Tesseract OCR available")
        else:
            logger.warning(
                "Tesseract OCR not found — install with: brew install tesseract tesseract-lang"
            )
    return _TESSERACT_AVAILABLE


def _is_valid_unicode(text: str) -> bool:
    """Determine whether extracted text contains valid Unicode Devanagari.

    Returns False if the text appears to be from a legacy font encoding
    (Preeti, Kantipur, etc.) — indicating OCR is needed.

    Heuristics:
    - If text has meaningful Devanagari (>10% of non-space chars), it's valid
    - If text is mostly ASCII alpha with high density of structural chars
      (brackets, pipes, semicolons), it's likely legacy-encoded Nepali
    - Pure English text (no Devanagari expected) passes validation
    """
    if not text or len(text.strip()) < 50:
        return True

    sample = text[:8000]
    non_space = re.sub(r"\s", "", sample)
    if not non_space:
        return True

    total = len(non_space)

    devanagari_count = len(_DEVANAGARI_RE.findall(non_space))
    devanagari_ratio = devanagari_count / total

    if devanagari_ratio > 0.1:
        return True

    ascii_alpha_count = len(_ASCII_ALPHA_RE.findall(non_space))
    ascii_ratio = ascii_alpha_count / total

    indicator_count = sum(1 for c in non_space if c in _LEGACY_FONT_INDICATORS)
    indicator_ratio = indicator_count / total

    is_legacy = ascii_ratio > 0.3 and indicator_ratio > 0.03

    if is_legacy:
        logger.info(
            "Legacy font encoding detected "
            "(devanagari=%.1f%%, ascii=%.1f%%, indicators=%.1f%%)",
            devanagari_ratio * 100,
            ascii_ratio * 100,
            indicator_ratio * 100,
        )

    return not is_legacy


def _normalize_text(text: str) -> str:
    """Light normalization: fix common OCR artifacts and normalize whitespace."""
    text = text.replace("\x0c", "\n\n")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def extract_text(file_path: str, mime_type: str) -> dict:
    """Extract text from a document file.

    Returns dict with keys: text, is_ocr, page_count
    """
    path = Path(file_path)
    logger.info("Extracting text from %s (mime=%s)", path.name, mime_type)

    if mime_type == "application/pdf":
        result = _extract_pdf(path)
    elif mime_type in (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/msword",
    ):
        result = _extract_docx(path)
    elif mime_type.startswith("image/"):
        result = _extract_image(path)
    else:
        result = _extract_text_file(path)

    result["text"] = _normalize_text(result["text"])

    logger.info(
        "Extracted %d chars from %s (ocr=%s, pages=%d)",
        len(result["text"]),
        path.name,
        result["is_ocr"],
        result["page_count"],
    )
    return result


def _extract_pdf(path: Path) -> dict:
    """Smart PDF extraction: native text first, OCR fallback for legacy fonts."""
    from pypdf import PdfReader

    reader = PdfReader(str(path))
    page_count = len(reader.pages)

    texts: list[str] = []
    for page in reader.pages:
        text = page.extract_text() or ""
        texts.append(text)

    full_text = "\n\n".join(texts)

    # Case 1: PDF has almost no embedded text (scanned document)
    if page_count > 0 and len(full_text.strip()) < 100 * page_count:
        logger.info("PDF has minimal embedded text — using OCR")
        return _ocr_pdf(path, page_count)

    # Case 2: Extracted text is legacy-encoded (Preeti, Kantipur, etc.)
    if not _is_valid_unicode(full_text):
        logger.info("PDF text is legacy font encoded — using OCR for correct Unicode")
        ocr_result = _ocr_pdf(path, page_count)
        if ocr_result["text"].strip():
            return ocr_result
        logger.warning("OCR produced no text; falling back to raw extraction")

    return {"text": full_text, "is_ocr": False, "page_count": page_count}


def _ocr_pdf(path: Path, page_count: int) -> dict:
    """OCR a PDF by rendering pages to images and running Tesseract.

    Processes pages in small batches to avoid loading hundreds of full-res
    images into memory simultaneously. Uses temp files for Tesseract input
    to avoid stdin/pipe issues with certain pytesseract + Leptonica combos.
    """
    if not _check_tesseract():
        logger.error("Cannot OCR: Tesseract is not installed")
        return {"text": "", "is_ocr": False, "page_count": page_count}

    import tempfile
    from pdf2image import convert_from_path
    import pytesseract

    batch_size = 5
    dpi = 250 if page_count > 50 else 300
    texts: list[str] = []

    logger.info("Starting OCR: %d pages at %d DPI (batch=%d)", page_count, dpi, batch_size)

    for start in range(1, page_count + 1, batch_size):
        end = min(start + batch_size - 1, page_count)
        try:
            images = convert_from_path(
                str(path), dpi=dpi, first_page=start, last_page=end
            )
        except Exception as e:
            logger.error("pdf2image failed on pages %d-%d: %s", start, end, e)
            continue

        for img in images:
            text = _ocr_image(img, pytesseract)
            texts.append(text)

        if end % 20 == 0 or end == page_count:
            logger.info("OCR progress: %d/%d pages", end, page_count)

    logger.info("OCR complete: %d pages processed", len(texts))
    return {"text": "\n\n".join(texts), "is_ocr": True, "page_count": page_count}


def _ocr_image(img, pytesseract) -> str:
    """Run Tesseract on a PIL image via a temp file (avoids stdin/pipe bugs)."""
    import tempfile

    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
        img.save(f, format="PNG")
        tmp_path = f.name

    try:
        text = pytesseract.image_to_string(tmp_path, lang=config.TESSERACT_LANG)
    finally:
        Path(tmp_path).unlink(missing_ok=True)

    return text


def _extract_docx(path: Path) -> dict:
    """Extract text from DOCX files."""
    from docx import Document

    doc = Document(str(path))
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    return {"text": "\n\n".join(paragraphs), "is_ocr": False, "page_count": 1}


def _extract_image(path: Path) -> dict:
    """OCR an image file directly."""
    if not _check_tesseract():
        logger.error("Cannot OCR image: Tesseract is not installed")
        return {"text": "", "is_ocr": False, "page_count": 1}

    import pytesseract

    text = pytesseract.image_to_string(str(path), lang=config.TESSERACT_LANG)
    return {"text": text, "is_ocr": True, "page_count": 1}


def _extract_text_file(path: Path) -> dict:
    """Extract from plain text files."""
    try:
        content = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        content = path.read_text(encoding="latin-1")
    return {"text": content, "is_ocr": False, "page_count": 1}

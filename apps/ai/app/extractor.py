"""Document text extraction with intelligent Unicode validation and OCR fallback.

Pipeline:
1. Extract text via native parsers (pypdf, python-docx, etc.)
2. Validate extracted text for Unicode quality (detects legacy font encodings)
3. If text fails validation → OCR the rendered pages (handles ALL legacy fonts)
4. Auto-detect document language and pick optimal Tesseract languages
5. Final cleanup and normalization

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

# Language detection patterns
_LATIN_RE = re.compile(r"[a-zA-Z]")
_CYRILLIC_RE = re.compile(r"[а-яА-Я]")
_CHINESE_RE = re.compile(r"[\u4e00-\u9fff]")
_JAPANESE_RE = re.compile(r"[\u3040-\u30ff\u31f0-\u31ff]")
_KOREAN_RE = re.compile(r"[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]")
_ARABIC_RE = re.compile(r"[\u0600-\u06ff]")

_TESSERACT_AVAILABLE: bool | None = None
_TESSERACT_LANGS_CACHE: dict[str, list[str]] | None = None


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


def _get_tesseract_langs() -> list[str]:
    """Get list of available Tesseract languages on the system."""
    global _TESSERACT_LANGS_CACHE
    if _TESSERACT_LANGS_CACHE is not None:
        return _TESSERACT_LANGS_CACHE

    try:
        import subprocess
        result = subprocess.run(
            ["tesseract", "--list-langs"],
            capture_output=True,
            text=True,
            timeout=5,
        )
        if result.returncode == 0:
            # First line is header, rest are language codes
            lines = result.stdout.strip().split("\n")
            if len(lines) > 1:
                _TESSERACT_LANGS_CACHE = lines[1:]
                return _TESSERACT_LANGS_CACHE
    except Exception as e:
        logger.warning("Failed to list Tesseract languages: %s", e)

    _TESSERACT_LANGS_CACHE = []
    return _TESSERACT_LANGS_CACHE


def _detect_script(text: str) -> str:
    """
    Detect the primary script in text.

    Returns: 'devanagari', 'latin', 'cyrillic', 'chinese', 'japanese', 'korean', 'arabic', 'mixed', 'unknown'
    """
    if not text or len(text.strip()) < 20:
        return "unknown"

    sample = text[:5000]
    non_space = re.sub(r"\s", "", sample)
    if not non_space:
        return "unknown"

    total = len(non_space)

    devanagari = len(_DEVANAGARI_RE.findall(non_space)) / total
    latin = len(_LATIN_RE.findall(non_space)) / total
    cyrillic = len(_CYRILLIC_RE.findall(non_space)) / total
    chinese = len(_CHINESE_RE.findall(non_space)) / total
    japanese = len(_JAPANESE_RE.findall(non_space)) / total
    korean = len(_KOREAN_RE.findall(non_space)) / total
    arabic = len(_ARABIC_RE.findall(non_space)) / total

    scores = {
        "devanagari": devanagari,
        "latin": latin,
        "cyrillic": cyrillic,
        "chinese": chinese,
        "japanese": japanese,
        "korean": korean,
        "arabic": arabic,
    }

    # Find dominant script
    max_script = max(scores, key=scores.get)
    max_score = scores[max_script]

    # Require at least 10% for a confident detection
    if max_score < 0.1:
        return "mixed"

    # Check if it's significantly dominant
    second_max = sorted(scores.values(), reverse=True)[1]
    if max_score > second_max * 2:
        return max_script

    return "mixed"


def _pick_tesseract_langs(text: str) -> str:
    """
    Pick optimal Tesseract language codes based on detected script.

    Returns a '+' joined string of language codes (e.g., 'nep+eng', 'eng', 'chi_sim+eng').
    """
    script = _detect_script(text)
    available = set(_get_tesseract_langs())

    # Map scripts to Tesseract language codes (in order of preference)
    script_to_langs = {
        "devanagari": ["nep", "hin", "eng"],
        "latin": ["eng"],
        "cyrillic": ["rus", "eng"],
        "chinese": ["chi_sim", "chi_tra", "eng"],
        "japanese": ["jpn", "eng"],
        "korean": ["kor", "eng"],
        "arabic": ["ara", "eng"],
        "mixed": ["eng", "nep"],  # Default fallback
    }

    preferred = script_to_langs.get(script, ["eng"])
    # Filter to only available languages
    selected = [lang for lang in preferred if lang in available]

    if not selected:
        # Ultimate fallback: check if eng is available
        if "eng" in available:
            selected = ["eng"]
        elif available:
            selected = [list(available)[0]]
        else:
            # No languages installed, use default
            logger.warning("No Tesseract languages available, using default config")
            return config.TESSERACT_LANG

    lang_str = "+".join(selected)
    logger.info("Detected script: %s, selected Tesseract langs: %s", script, lang_str)
    return lang_str


def _is_valid_unicode(text: str) -> bool:
    """
    Determine whether extracted text contains valid Unicode Devanagari.

    Returns False if the text appears to be from a legacy font encoding
    (Preeti, Kantipur, etc.) — indicating OCR is needed.

    FIXED: English-only docs with no Devanagari should NOT trigger OCR.
    Only flag as legacy when there are actual legacy encoding indicators.
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

    # If we have meaningful Devanagari, it's valid Unicode
    if devanagari_ratio > 0.1:
        return True

    ascii_alpha_count = len(_ASCII_ALPHA_RE.findall(non_space))
    ascii_ratio = ascii_alpha_count / total

    indicator_count = sum(1 for c in non_space if c in _LEGACY_FONT_INDICATORS)
    indicator_ratio = indicator_count / total

    # FIXED: Only flag as legacy if BOTH:
    # 1. High ASCII ratio (looks like encoded text)
    # 2. High indicator ratio (legacy font artifacts like {}[]|\\;+=/)
    # Pure English text has high ascii_ratio but LOW indicator_ratio → valid
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

    from pdf2image import convert_from_path
    import pytesseract

    batch_size = 5
    dpi = 250 if page_count > 50 else 300
    texts: list[str] = []

    logger.info("Starting OCR: %d pages at %d DPI (batch=%d)", page_count, dpi, batch_size)

    # Extract first page to detect language
    first_page_text = ""
    try:
        images = convert_from_path(str(path), dpi=dpi, first_page=1, last_page=1)
        if images:
            # Quick extraction to detect language
            import pytesseract
            with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
                images[0].save(f, format="PNG")
                tmp_path = f.name
            try:
                first_page_text = pytesseract.image_to_string(tmp_path, lang=config.TESSERACT_LANG)
            finally:
                Path(tmp_path).unlink(missing_ok=True)
    except Exception:
        pass

    # Detect optimal languages
    ocr_langs = _pick_tesseract_langs(first_page_text)
    logger.info("Using Tesseract languages for PDF OCR: %s", ocr_langs)

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
            text = _ocr_image(img, pytesseract, ocr_langs)
            texts.append(text)

        if end % 20 == 0 or end == page_count:
            logger.info("OCR progress: %d/%d pages", end, page_count)

    logger.info("OCR complete: %d pages processed", len(texts))
    return {"text": "\n\n".join(texts), "is_ocr": True, "page_count": page_count}


def _ocr_image(img, pytesseract, lang: str | None = None) -> str:
    """Run Tesseract on a PIL image via a temp file (avoids stdin/pipe bugs)."""
    import tempfile

    if lang is None:
        lang = config.TESSERACT_LANG

    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
        img.save(f, format="PNG")
        tmp_path = f.name

    try:
        text = pytesseract.image_to_string(tmp_path, lang=lang)
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
    """OCR an image file directly with auto-detected language."""
    if not _check_tesseract():
        logger.error("Cannot OCR image: Tesseract is not installed")
        return {"text": "", "is_ocr": False, "page_count": 1}

    import pytesseract

    # Detect language from a quick OCR pass
    try:
        quick_text = pytesseract.image_to_string(str(path), lang=config.TESSERACT_LANG)
        ocr_langs = _pick_tesseract_langs(quick_text)
    except Exception:
        ocr_langs = config.TESSERACT_LANG

    logger.info("Using Tesseract languages for image OCR: %s", ocr_langs)
    text = pytesseract.image_to_string(str(path), lang=ocr_langs)
    return {"text": text, "is_ocr": True, "page_count": 1}


def _extract_text_file(path: Path) -> dict:
    """Extract from plain text files."""
    try:
        content = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        content = path.read_text(encoding="latin-1")
    return {"text": content, "is_ocr": False, "page_count": 1}

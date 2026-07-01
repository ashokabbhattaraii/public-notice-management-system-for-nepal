from pathlib import Path

from app import config


def extract_text(file_path: str, mime_type: str) -> dict:
    path = Path(file_path)

    if mime_type == "application/pdf":
        return _extract_pdf(path)
    elif mime_type in (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/msword",
    ):
        return _extract_docx(path)
    elif mime_type.startswith("image/"):
        return _extract_image(path)
    else:
        return _extract_text(path)


def _extract_pdf(path: Path) -> dict:
    from pypdf import PdfReader

    reader = PdfReader(str(path))
    page_count = len(reader.pages)
    texts: list[str] = []

    for page in reader.pages:
        text = page.extract_text() or ""
        texts.append(text)

    full_text = "\n\n".join(texts)

    if page_count > 0 and len(full_text.strip()) < 100 * page_count:
        return _ocr_pdf(path, page_count)

    return {"text": full_text, "is_ocr": False, "page_count": page_count}


def _ocr_pdf(path: Path, page_count: int) -> dict:
    from pdf2image import convert_from_path
    import pytesseract

    images = convert_from_path(str(path))
    texts: list[str] = []

    for img in images:
        text = pytesseract.image_to_string(img, lang=config.TESSERACT_LANG)
        texts.append(text)

    return {"text": "\n\n".join(texts), "is_ocr": True, "page_count": page_count}


def _extract_docx(path: Path) -> dict:
    from docx import Document

    doc = Document(str(path))
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    return {"text": "\n\n".join(paragraphs), "is_ocr": False, "page_count": 1}


def _extract_image(path: Path) -> dict:
    from PIL import Image
    import pytesseract

    img = Image.open(str(path))
    text = pytesseract.image_to_string(img, lang=config.TESSERACT_LANG)
    return {"text": text, "is_ocr": True, "page_count": 1}


def _extract_text(path: Path) -> dict:
    try:
        content = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        content = path.read_text(encoding="latin-1")
    return {"text": content, "is_ocr": False, "page_count": 1}

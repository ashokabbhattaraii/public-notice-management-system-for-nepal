"""Generic notice/news scraper for admin-configured government/public websites.

Built on crawl4ai. An admin adds a source (base URL + one or two listing page
URLs — "Notice" and/or "News"). Because sites differ arbitrarily in markup,
listing extraction is *dynamic* rather than hand-coded per site:

  1. Heuristic detection (free, first try): scan the listing page's DOM for
     the group of sibling elements most likely to be repeating list rows
     (a table's `<tr>`s, a `<ul>`'s `<li>`s, repeated `<article>`/card divs,
     ...) and derive a crawl4ai `JsonCssExtractionStrategy` schema from it.
  2. LLM fallback (only if heuristics fail and GROQ_API_KEY is set): ask an
     LLM to read the cleaned HTML once and propose the same kind of schema.
  3. Caching: whichever schema works is handed back to the caller (the
     NestJS API, backed by Postgres) to store on the `ScrapeSource` row, so
     every subsequent run is pure CSS extraction — no heuristics or LLM
     calls needed unless the site's markup changes and extraction goes to
     zero rows, at which point detection re-runs automatically.

Detail-page content is *not* schema-based: any article page is fetched as
plain markdown/cleaned text via crawl4ai, which generalizes across sites far
better than a per-site body selector would.
"""

import json
import re
from dataclasses import dataclass
from datetime import datetime
from urllib.parse import urljoin, urlparse

import httpx
import nepali_datetime
from bs4 import BeautifulSoup
from crawl4ai import AsyncWebCrawler, BrowserConfig, CacheMode, CrawlerRunConfig
from crawl4ai.extraction_strategy import JsonCssExtractionStrategy

from app import config
from app.logger import get_logger

logger = get_logger(__name__)

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"

# Listing pages stop yielding new rows past this page number even if the site
# reports another `?page=` link; keeps a single scrape run bounded.
DEFAULT_MAX_PAGES = 3

# Tags/attrs stripped before heuristic analysis or LLM prompting — noise that
# never contains list content.
_STRIP_TAGS = ["script", "style", "noscript", "svg", "nav", "footer", "header"]

# Class/id substrings that mark navigation chrome rather than content rows;
# candidate groups scoring only on these are deprioritized.
_CHROME_HINTS = ("nav", "menu", "footer", "header", "breadcrumb", "pagination", "sidebar", "cookie")
_ROW_HINTS = ("row", "item", "card", "list", "entry", "result", "post", "notice", "news")

_DATE_FORMATS = [
    "%A, %B %d, %Y, %I:%M %p",   # Sunday, June 07, 2026, 09:07 PM
    "%B %d, %Y, %I:%M %p",       # June 02, 2026, 04:27 PM
    "%B %d, %Y",                  # June 02, 2026
    "%d %B %Y",                   # 02 June 2026
    "%d %B, %Y",                  # 02 June, 2026
    "%d-%m-%Y",
    "%d/%m/%Y",
    "%Y-%m-%d",
]
_DATE_LIKE_RE = re.compile(
    r"(\d{1,2}\s+[A-Za-z]+\s+\d{4})"
    r"|([A-Za-z]+\s+\d{1,2},?\s+\d{4})"
    r"|(\d{4}-\d{2}-\d{2})"
    r"|(\d{1,2}[/-]\d{1,2}[/-]\d{4})"
)

# Many Nepali government sites (mofa.gov.np included) serve a CDN-cached
# variant of the same listing page in Bikram Sambat/Devanagari — observed to
# vary by request independent of Accept-Language or JS settings, so both
# calendars must be parseable rather than avoided.
_DEVANAGARI_DIGITS = str.maketrans("०१२३४५६७८९", "0123456789")
_NEPALI_MONTHS = {
    "बैशाख": 1, "बैसाख": 1,
    "जेठ": 2, "जेष्ठ": 2,
    "असार": 3, "आषाढ": 3,
    "श्रावण": 4, "साउन": 4,
    "भदौ": 5, "भाद्र": 5,
    "असोज": 6, "आश्विन": 6,
    "कार्तिक": 7,
    "मंसिर": 8, "मार्गशीर्ष": 8,
    "पुष": 9, "पौष": 9,
    "माघ": 10,
    "फागुन": 11, "फाल्गुन": 11,
    "चैत": 12, "चैत्र": 12,
}
# Government templates disagree on token order ("जेठ २४, २०८३" month-first vs
# "२३ असार, २०८३" day-first); both the month name and the day are captured
# generically here and disambiguated afterwards via the month-name lookup.
_BS_DATE_RE = re.compile(
    r"([ऀ-ॿ]+|[०-९\d]{1,2})\s+([ऀ-ॿ]+|[०-९\d]{1,2}),?\s*([०-९\d]{4})"
    r"(?:,?\s*[ऀ-ॿ]+\s+([०-९\d]{1,2}):([०-९\d]{1,2}))?"
)


def _parse_bs_date(raw: str) -> str | None:
    match = _BS_DATE_RE.search(raw)
    if not match:
        return None
    token_a, token_b, year_str, hour_str, minute_str = match.groups()
    month = _NEPALI_MONTHS.get(token_a)
    day_str = token_b
    if month is None:
        month = _NEPALI_MONTHS.get(token_b)
        day_str = token_a
    if not month:
        return None
    try:
        day = int(day_str.translate(_DEVANAGARI_DIGITS))
        year = int(year_str.translate(_DEVANAGARI_DIGITS))
        ad_date = nepali_datetime.date(year, month, day).to_datetime_date()
    except Exception:
        return None

    if hour_str and minute_str:
        try:
            hour = int(hour_str.translate(_DEVANAGARI_DIGITS))
            minute = int(minute_str.translate(_DEVANAGARI_DIGITS))
            return datetime(ad_date.year, ad_date.month, ad_date.day, hour, minute).isoformat()
        except Exception:
            pass
    return datetime(ad_date.year, ad_date.month, ad_date.day).isoformat()


@dataclass
class ScrapedItem:
    category: str
    title: str
    source_url: str
    published_at: str | None
    summary: str | None
    content_text: str | None = None
    content_html: str | None = None
    attachment_url: str | None = None


# --- date / text helpers ---


def _parse_published(raw: str | None) -> str | None:
    if not raw:
        return None
    cleaned = re.sub(r"\s+", " ", raw).strip().strip(",")
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(cleaned, fmt).isoformat()
        except ValueError:
            continue
    bs_parsed = _parse_bs_date(cleaned)
    if bs_parsed:
        return bs_parsed
    match = _DATE_LIKE_RE.search(cleaned)
    if match:
        return _parse_published(match.group(0))
    return None


def _clean_text(raw: str | None) -> str | None:
    if not raw:
        return None
    text = re.sub(r"\s+", " ", raw).strip()
    return text or None


def _absolute_url(base_url: str, href: str | None) -> str | None:
    if not href:
        return None
    href = href.strip()
    if href.startswith("javascript:") or href.startswith("mailto:") or href == "#":
        return None
    return urljoin(base_url, href)


# --- heuristic schema detection ---


def _element_signature(tag) -> str:
    classes = sorted(c for c in tag.get("class", []) if c)
    return f"{tag.name}." + ".".join(classes) if classes else tag.name


def _css_selector_for_signature(tag, signature: str) -> str:
    if tag.name == "tr":
        # Table rows are reliably matched generically; a class-qualified
        # selector is used only when the row itself carries distinguishing
        # classes (plain `tr` is the common case).
        classes = sorted(c for c in tag.get("class", []) if c)
        return "table tbody tr" if not classes else f"tr.{'.'.join(classes)}"
    classes = sorted(c for c in tag.get("class", []) if c)
    return f"{tag.name}.{'.'.join(classes)}" if classes else tag.name


_FILE_EXTENSIONS = (".pdf", ".jpg", ".jpeg", ".png", ".gif", ".doc", ".docx", ".xls", ".xlsx", ".zip")


def _nth_child_selector(el) -> str | None:
    """CSS `tag:nth-child(n)` for a direct child of the base row, or None if
    `el` isn't a direct child (deeper nesting isn't generalized)."""
    parent = el.parent
    if parent is None:
        return None
    siblings = parent.find_all(recursive=False)
    try:
        idx = siblings.index(el) + 1
    except ValueError:
        return None
    return f"{el.name}:nth-child({idx})"


def _pick_detail_anchor(sample, base_url: str):
    """Choose the anchor most likely to link to the article's detail page —
    not an attachment (PDF/image) or an external CDN link."""
    base_netloc = urlparse(base_url).netloc
    best_anchor, best_score = None, float("-inf")
    for anchor in sample.find_all("a", href=True):
        href = anchor["href"].strip()
        if not href or href in ("#", "javascript:void(0)"):
            continue
        score = 0.0
        lower_href = href.lower()
        if any(lower_href.endswith(ext) for ext in _FILE_EXTENSIONS):
            score -= 10
        parsed = urlparse(href)
        if parsed.netloc and parsed.netloc != base_netloc:
            score -= 5
        if re.search(r"\d", href):
            score += 2
        if href.count("/") > 1:
            score += 1
        # Later anchors in the row win ties — "view detail" links commonly
        # render after attachment/thumbnail links in table/card markup.
        score += 0.01
        if score >= best_score:
            best_anchor, best_score = anchor, score
    return best_anchor


def _pick_attachment_anchor(sample, base_url: str, exclude=None):
    """Choose the anchor most likely to be a downloadable attachment (PDF,
    image, office doc, archive) — the inverse criteria of
    `_pick_detail_anchor`. Returns None if no such link exists in the row."""
    base_netloc = urlparse(base_url).netloc
    best_anchor, best_score = None, float("-inf")
    for anchor in sample.find_all("a", href=True):
        if anchor is exclude:
            continue
        href = anchor["href"].strip()
        if not href or href in ("#", "javascript:void(0)"):
            continue
        lower_href = href.lower().split("?")[0]
        if not any(lower_href.endswith(ext) for ext in _FILE_EXTENSIONS):
            continue
        score = 1.0
        parsed = urlparse(href)
        if parsed.netloc and parsed.netloc != base_netloc:
            score += 1  # attachments commonly live on a separate CDN/media host
        if score > best_score:
            best_anchor, best_score = anchor, score
    return best_anchor


def _anchor_selector(anchor) -> str:
    """A selector for this specific anchor, scoped by its parent cell when
    possible — this matters when a row has more than one anchor (e.g. a
    detail link and an attachment link) that would otherwise collide on the
    same generic `"a"` selector."""
    classes = sorted(c for c in anchor.get("class", []) if c)
    if classes:
        return f"a.{'.'.join(classes)}"
    nth = _nth_child_selector(anchor.parent) if anchor.parent and anchor.parent.name != anchor.name else None
    if nth:
        return f"{nth} a"
    return "a"


def _pick_title_selector(sample, skip_el) -> str:
    """Choose the row's most title-like text container: the longest text
    among direct children, excluding the detail anchor's own cell, dates,
    and short numeric/ordinal columns."""
    best_el, best_len = None, 0
    for child in sample.find_all(recursive=False):
        if child is skip_el:
            continue
        text = child.get_text(" ", strip=True)
        if not text or text.isdigit() or _DATE_LIKE_RE.fullmatch(text):
            continue
        if len(text) > best_len:
            best_el, best_len = child, len(text)

    if best_el is not None and best_len >= 8:
        nth = _nth_child_selector(best_el)
        if nth:
            return nth
        classes = sorted(c for c in best_el.get("class", []) if c)
        return f"{best_el.name}.{'.'.join(classes)}" if classes else best_el.name

    heading = sample.find(["h1", "h2", "h3", "h4"])
    if heading and heading.get_text(strip=True):
        return heading.name
    return "a"


def _pick_date_selector(sample) -> str | None:
    time_tag = sample.find("time")
    if time_tag:
        return "time"

    for el in sample.find_all(True):
        classes = " ".join(el.get("class", [])).lower()
        if "date" in classes or ("time" in classes and el.name != "time"):
            nth = _nth_child_selector(el)
            if nth:
                return nth
            own_classes = sorted(c for c in el.get("class", []) if c)
            return f"{el.name}.{'.'.join(own_classes)}" if own_classes else el.name

    for child in sample.find_all(recursive=False):
        text = child.get_text(" ", strip=True)
        if text and _DATE_LIKE_RE.search(text):
            return _nth_child_selector(child)

    return None


def _detect_schema_heuristic(html: str, base_url: str) -> dict | None:
    soup = BeautifulSoup(html, "html.parser")
    for tag_name in _STRIP_TAGS:
        for el in soup.find_all(tag_name):
            el.decompose()

    groups: dict[str, list] = {}
    for tag in soup.find_all(True):
        if not tag.find("a", href=True):
            continue
        text = tag.get_text(" ", strip=True)
        if len(text) < 8:
            continue
        sig = _element_signature(tag)
        groups.setdefault(sig, []).append(tag)

    best_sig, best_score = None, 0.0
    for sig, elements in groups.items():
        count = len(elements)
        if count < 3 or count > 300:
            continue
        lower_sig = sig.lower()
        score = float(count)
        if any(h in lower_sig for h in _ROW_HINTS) or lower_sig == "tr":
            score *= 2.0
        if any(h in lower_sig for h in _CHROME_HINTS):
            score *= 0.2
        if score > best_score:
            best_sig, best_score = sig, score

    if not best_sig:
        return None

    sample = groups[best_sig][0]
    base_selector = _css_selector_for_signature(sample, best_sig)

    anchor = _pick_detail_anchor(sample, base_url)
    if anchor is None:
        return None

    detail_selector = _anchor_selector(anchor)
    anchor_cell = anchor.parent if anchor.parent and anchor.parent.name in ("td", "th") else anchor

    fields = [
        {"name": "detail_href", "selector": detail_selector, "type": "attribute", "attribute": "href"},
        {"name": "title", "selector": _pick_title_selector(sample, anchor_cell), "type": "text"},
    ]

    date_selector = _pick_date_selector(sample)
    if date_selector:
        fields.append({"name": "published_raw", "selector": date_selector, "type": "text"})

    attachment_anchor = _pick_attachment_anchor(sample, base_url, exclude=anchor)
    if attachment_anchor is not None:
        fields.append(
            {
                "name": "attachment_href",
                "selector": _anchor_selector(attachment_anchor),
                "type": "attribute",
                "attribute": "href",
            }
        )

    return {"name": "auto_detected", "baseSelector": base_selector, "fields": fields}


# --- LLM-assisted schema fallback ---

_SCHEMA_PROMPT = """You analyze the HTML of a government/public website's notice or news LISTING page and produce a CSS extraction schema as JSON.

Return ONLY a JSON object (no markdown fences, no commentary) with this exact shape:
{"baseSelector": "<css selector matching each repeating row/card>", "fields": [
  {"name": "title", "selector": "<css selector relative to baseSelector>", "type": "text"},
  {"name": "detail_href", "selector": "<css selector relative to baseSelector>", "type": "attribute", "attribute": "href"},
  {"name": "published_raw", "selector": "<css selector relative to baseSelector, omit this field if no date is visible>", "type": "text"},
  {"name": "attachment_href", "selector": "<css selector relative to baseSelector, omit this field entirely if no row links to a downloadable file>", "type": "attribute", "attribute": "href"}
]}

Rules:
- baseSelector must match ONLY the repeating list/table rows that link to individual notice or news articles — never navigation, footer, or sidebar/"recent posts" widget elements duplicated across many pages of the site.
- If the page contains a `<table>` whose header row mentions a title-like column and a date/published column, prefer that table's body rows over any card/grid layout — tables are the primary content on government listing pages, grids are often a secondary "recent" widget.
- detail_href must resolve to an <a> with an href attribute pointing to the article's detail page — never a PDF/image/office-document/archive link.
- attachment_href, if present, must resolve to an <a> whose href points to a downloadable file (.pdf, .doc(x), .xls(x), .ppt(x), .jpg/.jpeg/.png/.gif, .zip) — this is usually a separate "File Type"/download column from detail_href, never the same anchor.
- Selectors are evaluated relative to each baseSelector match (like BeautifulSoup's .select_one on that element)."""


async def _detect_schema_llm(html: str, category: str) -> dict | None:
    if not config.GROQ_API_KEY:
        return None

    soup = BeautifulSoup(html, "html.parser")
    for tag_name in _STRIP_TAGS:
        for el in soup.find_all(tag_name):
            el.decompose()
    trimmed_html = str(soup)[:30000]

    payload = {
        "model": config.GROQ_MODEL,
        "messages": [
            {"role": "system", "content": _SCHEMA_PROMPT},
            {
                "role": "user",
                "content": f"Category: {category}\n\nHTML:\n{trimmed_html}",
            },
        ],
        "max_tokens": 800,
        "temperature": 0.0,
    }

    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            response = await client.post(
                GROQ_API_URL,
                headers={
                    "Authorization": f"Bearer {config.GROQ_API_KEY}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
        if response.status_code != 200:
            logger.warning("LLM schema detection: Groq returned %d", response.status_code)
            return None
        content = response.json()["choices"][0]["message"]["content"]
        content = re.sub(r"^```(json)?|```$", "", content.strip(), flags=re.MULTILINE).strip()
        schema = json.loads(content)
        if not schema.get("baseSelector") or not schema.get("fields"):
            return None
        schema["name"] = "llm_detected"
        return schema
    except Exception:
        logger.exception("LLM schema detection failed")
        return None


# --- crawling ---


async def _fetch_raw_html(crawler: AsyncWebCrawler, url: str) -> str | None:
    result = await crawler.arun(
        url=url,
        config=CrawlerRunConfig(cache_mode=CacheMode.BYPASS),
    )
    if not result.success:
        logger.warning("Raw fetch failed for %s: %s", url, result.error_message)
        return None
    return result.html


async def _extract_with_schema(crawler: AsyncWebCrawler, url: str, schema: dict) -> list[dict]:
    result = await crawler.arun(
        url=url,
        config=CrawlerRunConfig(
            extraction_strategy=JsonCssExtractionStrategy(schema),
            cache_mode=CacheMode.BYPASS,
        ),
    )
    if not result.success:
        logger.warning("Listing crawl failed for %s: %s", url, result.error_message)
        return []
    try:
        return json.loads(result.extracted_content or "[]")
    except json.JSONDecodeError:
        return []


async def _resolve_schema(
    crawler: AsyncWebCrawler, listing_url: str, category: str, cached_schema: dict | None
) -> tuple[dict | None, bool]:
    """Return (schema, is_newly_detected). Tries the cached schema first;
    on zero rows (or no cache), re-detects: LLM first when an API key is
    configured (it reliably disambiguates the real listing from sidebar
    "recent posts" widgets, and the cost is paid once and then cached),
    falling back to free structural heuristics otherwise."""
    if cached_schema:
        rows = await _extract_with_schema(crawler, listing_url, cached_schema)
        if rows:
            return cached_schema, False
        logger.info("Cached schema for %s/%s yielded no rows; re-detecting", listing_url, category)

    html = await _fetch_raw_html(crawler, listing_url)
    if not html:
        return None, False

    if config.GROQ_API_KEY:
        schema = await _detect_schema_llm(html, category)
        if schema:
            rows = await _extract_with_schema(crawler, listing_url, schema)
            if rows:
                return schema, True

    schema = _detect_schema_heuristic(html, listing_url)
    if schema:
        rows = await _extract_with_schema(crawler, listing_url, schema)
        if rows:
            return schema, True

    logger.warning("Could not detect a working schema for %s (%s)", listing_url, category)
    return None, False


# Common article-body containers, checked in order; the first with
# substantial text wins. Falls back to the whole (nav/chrome-stripped) page
# so unfamiliar markup still yields something rather than nothing.
_CONTENT_SELECTORS = [
    "article",
    "main",
    "[role='main']",
    ".details__desc",
    ".entry-content",
    ".post-content",
    ".article-content",
    ".content-detail",
    ".detail-content",
    ".news-detail",
    ".single-content",
]


def _extract_main_content(soup: BeautifulSoup):
    for selector in _CONTENT_SELECTORS:
        el = soup.select_one(selector)
        if el and len(el.get_text(strip=True)) > 80:
            return el
    return soup.body or soup


# DOM ids/classes of common inline PDF/flipbook viewer widgets — many gov
# sites embed notices this way rather than as HTML text or a plain download
# link. The viewer's own toolbar chrome ("Zoom In", "Next Page", "Loading PDF
# Worker CORS …") is real visible text in the static HTML, so a naive "grab
# the main content text" pass captures it as if it were the notice body.
_PDF_VIEWER_SELECTORS = (
    "#viewerContainer",   # Mozilla pdf.js
    "#toolbarViewer",
    ".pdfViewer",
    ".textLayer",
    "#PDFViewerApplication",
    "#loadingBar",
    "#flipbookContainer",  # DearFlip
    "._df_book",
    ".df-container",
)

# Flipbook/PDF-viewer widgets often configure their source as a JS variable
# rather than a plain <a href>, e.g. `var pdf = 'https://.../file.pdf';`.
_JS_FILE_URL_RE = re.compile(r"""['"](https?://[^'"]+?\.(?:pdf|docx?|xlsx?|pptx?))['"]""", re.IGNORECASE)


def _is_pdf_viewer_embed(el) -> bool:
    return any(el.select_one(sel) for sel in _PDF_VIEWER_SELECTORS)


def _find_attachment_in_page(soup: BeautifulSoup, base_url: str) -> str | None:
    """Fallback attachment discovery on the detail page itself, for sites
    that link the PDF/image/doc from the article body rather than the
    listing row. Picks the first file-like link found anywhere on the page,
    then falls back to scanning inline <script> tags for a JS-configured
    viewer source URL (e.g. DearFlip-style flipbook embeds)."""
    for anchor in soup.find_all("a", href=True):
        href = anchor["href"].strip()
        if not href:
            continue
        lower_href = href.lower().split("?")[0]
        if any(lower_href.endswith(ext) for ext in _FILE_EXTENSIONS):
            return _absolute_url(base_url, href)

    return None


def _find_attachment_in_scripts(html: str, base_url: str) -> str | None:
    """Scan raw (pre-strip) HTML for a JS-configured viewer source URL, e.g.
    DearFlip-style `var pdf = 'https://.../file.pdf';` embeds. Must run
    against the original HTML — `<script>` tags are removed before the rest
    of detail-page parsing."""
    match = _JS_FILE_URL_RE.search(html)
    return _absolute_url(base_url, match.group(1)) if match else None


async def _crawl_detail_generic(crawler: AsyncWebCrawler, url: str, base_url: str) -> dict | None:
    """Fetch an article/detail page generically (no per-site schema)."""
    result = await crawler.arun(
        url=url,
        config=CrawlerRunConfig(cache_mode=CacheMode.BYPASS),
    )
    if not result.success:
        logger.warning("Detail crawl failed for %s: %s", url, result.error_message)
        return None

    soup = BeautifulSoup(result.html or "", "html.parser")
    for tag_name in _STRIP_TAGS + ["aside"]:
        for el in soup.find_all(tag_name):
            el.decompose()

    h1 = soup.find("h1")
    title = _clean_text(h1.get_text(" ", strip=True)) if h1 else None

    time_tag = soup.find("time")
    published_raw = time_tag.get_text(" ", strip=True) if time_tag else None

    content_el = _extract_main_content(soup)
    if _is_pdf_viewer_embed(content_el) or _is_pdf_viewer_embed(soup):
        # The "content" here is a PDF.js viewer widget, not article text —
        # its toolbar/loading-bar chrome would otherwise be scraped verbatim
        # as if it were the notice body. The real content is the PDF itself,
        # captured separately as attachment_url below.
        content_text = None
        content_html = None
    else:
        content_text = _clean_text(content_el.get_text(" ", strip=True))
        content_html = str(content_el)

    # Prefer an attachment linked from within the article body; fall back to
    # anywhere else on the (chrome-stripped) page, then a JS-embedded viewer
    # source (script tags are stripped by this point, hence the raw-HTML scan).
    attachment_url = (
        _find_attachment_in_page(content_el, base_url)
        or _find_attachment_in_page(soup, base_url)
        or _find_attachment_in_scripts(result.html or "", base_url)
    )

    return {
        "title": title,
        "published_raw": published_raw,
        "content_text": content_text,
        "content_html": content_html,
        "attachment_url": attachment_url,
    }


@dataclass
class PaginationConfig:
    """How to build a listing page's URL for page N. Sites disagree wildly
    on this, so it's admin-configurable per source rather than assumed."""
    pagination_type: str = "QUERY_PARAM"  # QUERY_PARAM | PATH_TEMPLATE | NONE
    param: str = "page"
    start_page: int = 1


def _paginated_url(listing_url: str, page_index: int, config: PaginationConfig) -> str:
    """`page_index` is 0-based (0 = first page fetched)."""
    page_number = config.start_page + page_index

    if config.pagination_type == "NONE":
        return listing_url if page_index == 0 else ""

    if config.pagination_type == "PATH_TEMPLATE":
        if "{page}" in listing_url:
            return listing_url.replace("{page}", str(page_number))
        # No placeholder configured — behave like a single page rather than
        # silently repeating page 1's URL for every "page".
        return listing_url if page_index == 0 else ""

    # QUERY_PARAM (default)
    if page_index == 0 and config.start_page == 1:
        return listing_url
    separator = "&" if urlparse(listing_url).query else "?"
    return f"{listing_url}{separator}{config.param}={page_number}"


async def scrape_source(
    base_url: str,
    category_urls: dict[str, str],
    cached_schemas: dict[str, dict | None] | None = None,
    known_urls: set[str] | None = None,
    max_pages: int = DEFAULT_MAX_PAGES,
    fetch_detail: bool = True,
    pagination: PaginationConfig | None = None,
    on_progress=None,
) -> tuple[list[ScrapedItem], dict[str, dict]]:
    """Scrape an admin-configured source's notice/news listings.

    `category_urls` maps "NOTICE"/"NEWS" to that category's listing page URL
    (only categories present are scraped). `cached_schemas` supplies a
    previously-detected extraction schema per category so most runs skip
    detection entirely. `pagination` controls how page URLs are built (see
    `PaginationConfig`). `on_progress(message: str)`, if given, is called at
    each meaningful step for live status reporting. Returns (items,
    schemas_used) — schemas_used holds every schema (cached or freshly
    detected) actually used, for the caller to persist for next time.
    """
    cached_schemas = cached_schemas or {}
    known_urls = known_urls or set()
    pagination = pagination or PaginationConfig()
    report = on_progress or (lambda _msg: None)
    items: list[ScrapedItem] = []
    schemas_used: dict[str, dict] = {}
    seen_urls: set[str] = set()

    # JS stays enabled: many admin-added sites render their listing entirely
    # client-side, and disabling it does not avoid the Bikram Sambat/English
    # date-locale variance seen on some Nepali gov sites (that's a CDN-level
    # cache split, not JS — see _parse_bs_date).
    browser_config = BrowserConfig(headless=True, verbose=False)

    async with AsyncWebCrawler(config=browser_config) as crawler:
        for category, listing_url in category_urls.items():
            if not listing_url:
                continue

            report(f"Resolving extraction pattern for {category.title()}…")
            schema, is_new = await _resolve_schema(
                crawler, listing_url, category, cached_schemas.get(category)
            )
            if not schema:
                report(f"Could not detect a listing pattern for {category.title()}; skipping")
                continue
            schemas_used[category] = schema
            report(
                f"{'Detected' if is_new else 'Reused cached'} extraction pattern for {category.title()}"
            )

            effective_max_pages = 1 if pagination.pagination_type == "NONE" else max_pages
            for page_index in range(effective_max_pages):
                url = _paginated_url(listing_url, page_index, pagination)
                if not url:
                    break
                report(f"Crawling {category.title()} listing, page {page_index + 1}…")
                rows = await _extract_with_schema(crawler, url, schema)
                if not rows:
                    break

                new_rows_on_page = 0
                for row in rows:
                    source_url = _absolute_url(base_url, row.get("detail_href"))
                    if not source_url or source_url in seen_urls:
                        continue
                    seen_urls.add(source_url)
                    new_rows_on_page += 1

                    title = _clean_text(row.get("title")) or "(untitled)"
                    published_at = _parse_published(row.get("published_raw"))
                    attachment_url = _absolute_url(base_url, row.get("attachment_href"))

                    content_text = None
                    content_html = None
                    if fetch_detail and source_url not in known_urls:
                        report(f"Fetching detail: {title[:60]}")
                        detail = await _crawl_detail_generic(crawler, source_url, base_url)
                        if detail:
                            content_text = detail.get("content_text")
                            content_html = detail.get("content_html")
                            if not published_at:
                                published_at = _parse_published(detail.get("published_raw"))
                            if title == "(untitled)" and detail.get("title"):
                                title = detail["title"]
                            # The listing row's attachment link (if any) wins —
                            # it's usually the canonical one for that specific
                            # notice, vs. a body-embedded link on the detail page.
                            if not attachment_url and detail.get("attachment_url"):
                                attachment_url = detail["attachment_url"]

                    items.append(
                        ScrapedItem(
                            category=category,
                            title=title,
                            source_url=source_url,
                            published_at=published_at,
                            summary=(content_text or title)[:500],
                            content_text=content_text,
                            content_html=content_html,
                            attachment_url=attachment_url,
                        )
                    )

                report(f"Found {new_rows_on_page} new item(s) on {category.title()} page {page_index + 1}")

                # Sites without real pagination re-render page 1's rows for
                # any page param; treat "nothing new" as end of pagination.
                if new_rows_on_page == 0:
                    break

    report(f"Scrape complete — {len(items)} item(s) total")
    logger.info(
        "Scrape produced %d item(s) for base_url=%s categories=%s",
        len(items),
        base_url,
        list(category_urls.keys()),
    )
    return items, schemas_used

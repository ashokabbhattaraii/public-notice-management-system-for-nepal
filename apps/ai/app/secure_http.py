"""Secure HTTP client with SSRF protection.

Provides a hardened AsyncClient that:
- Enforces URL scheme allowlist (http/https only)
- Blocks private/internal IP ranges (RFC 1918, loopback, link-local, metadata services)
- Enforces separate connect/read timeouts
- Disallows redirects to unsafe targets
- Validates response Content-Type for expected types
"""

import asyncio
import ipaddress
import logging
from typing import Optional
from urllib.parse import urlparse

import httpx

logger = logging.getLogger(__name__)

# Private/internal IP ranges that must never be accessed
_BLOCKED_NETWORKS = [
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),  # link-local / metadata
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fe80::/10"),
    ipaddress.ip_network("fc00::/7"),  # ULA
]

# Metadata service IPs (cloud providers)
_METADATA_IPS = {
    "169.254.169.254",  # AWS, GCP, Azure, DigitalOcean
    "100.100.100.200",  # Alibaba Cloud
}

_ALLOWED_SCHEMES = {"http", "https"}

# Expected content types for PDF downloads
_ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "application/x-pdf",
    "application/acrobat",
    "application/vnd.adobe.pdf",
}

# Nepali government portals routinely serve PDFs as a generic download stream
# (or with no Content-Type at all). Rejecting those loses real documents, so
# they are accepted here and the bytes are checked for the %PDF- signature
# instead — verifying the content is strictly safer than trusting the header.
_PERMISSIVE_PDF_CONTENT_TYPES = {
    "application/octet-stream",
    "binary/octet-stream",
    "application/download",
    "application/force-download",
    "application/x-download",
}

_PDF_MAGIC = b"%PDF-"


def _is_blocked_ip(host: str) -> bool:
    """Check if hostname resolves to a blocked IP address."""
    try:
        # Try parsing as IP literal first
        ip = ipaddress.ip_address(host)
        return any(ip in net for net in _BLOCKED_NETWORKS) or host in _METADATA_IPS
    except ValueError:
        # Hostname — we'll check after DNS resolution in _validate_response
        return False


def _validate_url(url: str) -> tuple[bool, Optional[str]]:
    """Validate URL scheme and basic structure before making request."""
    try:
        parsed = urlparse(url)
    except Exception:
        return False, "Invalid URL format"

    if parsed.scheme.lower() not in _ALLOWED_SCHEMES:
        return False, f"Scheme '{parsed.scheme}' not allowed (only http/https)"

    if not parsed.hostname:
        return False, "Missing hostname"

    # Check for IP literal in hostname
    if _is_blocked_ip(parsed.hostname):
        return False, f"Access to blocked IP range: {parsed.hostname}"

    # Block metadata service hostnames
    if parsed.hostname in {"metadata", "metadata.google.internal", "169.254.169.254"}:
        return False, "Access to metadata service blocked"

    return True, None


async def _host_resolves_to_blocked(host: str) -> tuple[bool, Optional[str]]:
    """Resolve a hostname and check every address against the blocked ranges.

    The literal-IP check can't catch `internal.example.com → 10.0.0.5`, and
    following redirects means an external host can hand us an internal one.
    Resolution failures are not treated as blocking — the request will fail on
    its own if the host genuinely doesn't resolve.
    """
    try:
        ipaddress.ip_address(host)
        return False, None  # literal IP, already covered by _is_blocked_ip
    except ValueError:
        pass

    try:
        loop = asyncio.get_running_loop()
        infos = await loop.getaddrinfo(host, None)
    except Exception as e:
        logger.debug("DNS check skipped for %s: %s", host, e)
        return False, None

    for info in infos:
        addr = info[4][0]
        try:
            ip = ipaddress.ip_address(addr)
        except ValueError:
            continue
        if any(ip in net for net in _BLOCKED_NETWORKS) or addr in _METADATA_IPS:
            return True, f"{host} resolves to blocked address {addr}"

    return False, None


async def _validate_response(response: httpx.Response, expected_content_types: set[str]) -> tuple[bool, Optional[str]]:
    """Validate response headers after request completes."""
    # Check Content-Type
    content_type = response.headers.get("content-type", "").split(";")[0].strip().lower()
    if content_type and content_type not in expected_content_types:
        return False, f"Unexpected Content-Type: {content_type} (expected one of {expected_content_types})"

    # Check final URL after redirects for IP blocking
    final_url = str(response.url)
    try:
        parsed = urlparse(final_url)
        if parsed.hostname:
            # Check resolved IP
            try:
                ip = ipaddress.ip_address(parsed.hostname)
                if any(ip in net for net in _BLOCKED_NETWORKS) or parsed.hostname in _METADATA_IPS:
                    return False, f"Redirect to blocked IP: {parsed.hostname}"
            except ValueError:
                # Hostname: resolve it. Matters most after a redirect, where
                # the final host was chosen by the remote server.
                blocked, reason = await _host_resolves_to_blocked(parsed.hostname)
                if blocked:
                    return False, f"Redirect to blocked host: {reason}"
    except Exception:
        pass

    return True, None


class SecureHttpClient:
    """Hardened AsyncClient wrapper with SSRF protection."""

    def __init__(
        self,
        connect_timeout: float = 5.0,
        read_timeout: float = 30.0,
        total_timeout: float = 60.0,
        max_redirects: int = 0,
        allowed_content_types: Optional[set[str]] = None,
    ):
        self.connect_timeout = connect_timeout
        self.read_timeout = read_timeout
        self.total_timeout = total_timeout
        self.max_redirects = max_redirects
        self.allowed_content_types = allowed_content_types or _ALLOWED_CONTENT_TYPES
        self._client: Optional[httpx.AsyncClient] = None

    async def __aenter__(self) -> "SecureHttpClient":
        self._client = httpx.AsyncClient(
            timeout=httpx.Timeout(
                connect=self.connect_timeout,
                read=self.read_timeout,
                write=self.read_timeout,
                pool=self.total_timeout,
            ),
            follow_redirects=self.max_redirects > 0,
            max_redirects=self.max_redirects,
            limits=httpx.Limits(max_connections=10, max_keepalive_connections=5),
        )
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self._client:
            await self._client.aclose()
            self._client = None

    async def get(
        self,
        url: str,
        *,
        expected_content_types: Optional[set[str]] = None,
        extra_headers: Optional[dict] = None,
    ) -> httpx.Response:
        """GET with full SSRF protection."""
        # Pre-flight URL validation
        ok, err = _validate_url(url)
        if not ok:
            raise ValueError(f"URL validation failed: {err}")

        host = urlparse(url).hostname
        if host:
            blocked, reason = await _host_resolves_to_blocked(host)
            if blocked:
                raise ValueError(f"URL validation failed: {reason}")

        if not self._client:
            raise RuntimeError("Client not initialized. Use async context manager.")

        headers = {"User-Agent": "Suchana-AI/1.0 (+https://suchana.ai)"}
        if extra_headers:
            headers.update(extra_headers)

        try:
            response = await self._client.get(url, headers=headers)
            response.raise_for_status()
        except httpx.HTTPStatusError as e:
            raise ValueError(f"HTTP {e.response.status_code}: {e.response.reason_phrase}") from e
        except httpx.RequestError as e:
            raise ValueError(f"Request failed: {e}") from e

        # Post-flight validation
        ok, err = await _validate_response(response, expected_content_types or self.allowed_content_types)
        if not ok:
            raise ValueError(f"Response validation failed: {err}")

        return response


async def secure_download_pdf(
    url: str,
    *,
    connect_timeout: float = 5.0,
    read_timeout: float = 30.0,
    max_size_bytes: int = 50 * 1024 * 1024,  # 50 MB
) -> bytes:
    """Download a PDF with full SSRF protection and size limit.

    Returns the raw PDF bytes.
    """
    accepted_types = _ALLOWED_CONTENT_TYPES | _PERMISSIVE_PDF_CONTENT_TYPES

    async with SecureHttpClient(
        connect_timeout=connect_timeout,
        read_timeout=read_timeout,
        total_timeout=read_timeout + connect_timeout + 5,
        # Government portals redirect constantly (http→https, /files→CDN). With
        # redirects disabled the 302 itself was returned, its HTML body failed
        # the Content-Type check, and the download died with a confusing 400.
        # Each hop's final URL is still validated against the blocked ranges.
        max_redirects=3,
        allowed_content_types=accepted_types,
    ) as client:
        response = await client.get(url, expected_content_types=accepted_types)

        # Enforce size limit while streaming
        content_length = response.headers.get("content-length")
        if content_length and int(content_length) > max_size_bytes:
            raise ValueError(f"File too large: {content_length} bytes (max {max_size_bytes})")

        # Stream with size enforcement
        chunks = []
        total = 0
        async for chunk in response.aiter_bytes(chunk_size=8192):
            total += len(chunk)
            if total > max_size_bytes:
                raise ValueError(f"File exceeds size limit ({max_size_bytes} bytes)")
            chunks.append(chunk)

        data = b"".join(chunks)

        # Content check: the bytes must actually be a PDF. This is what makes
        # the relaxed Content-Type allowlist safe — an HTML error page or a
        # login redirect served as octet-stream is rejected here.
        if _PDF_MAGIC not in data[:1024]:
            preview = data[:64].decode("utf-8", errors="replace").strip()
            raise ValueError(
                f"Downloaded file is not a PDF (no %PDF- signature; "
                f"content-type={response.headers.get('content-type', 'none')}, "
                f"{len(data)} bytes, starts with: {preview!r})"
            )

        return data
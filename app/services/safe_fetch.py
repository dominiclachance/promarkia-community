from __future__ import annotations

import ipaddress
import socket
from html.parser import HTMLParser
from urllib.parse import urljoin, urlsplit

import httpx


ALLOWED_CONTENT_TYPES = ("text/html", "text/plain", "application/xhtml+xml")


class UnsafeUrlError(ValueError):
    pass


def _is_public_ip(value: str) -> bool:
    address = ipaddress.ip_address(value)
    return not (
        address.is_private
        or address.is_loopback
        or address.is_link_local
        or address.is_multicast
        or address.is_reserved
        or address.is_unspecified
    )


def resolve_public_ips(hostname: str) -> set[str]:
    try:
        results = socket.getaddrinfo(hostname, None, type=socket.SOCK_STREAM)
    except socket.gaierror as error:
        raise UnsafeUrlError("Company hostname could not be resolved") from error
    addresses = {item[4][0] for item in results}
    if not addresses or any(not _is_public_ip(address) for address in addresses):
        raise UnsafeUrlError("Private, local or reserved network destinations are not allowed")
    return addresses


def validate_public_url(value: str) -> str:
    parsed = urlsplit(value)
    if parsed.scheme not in {"http", "https"}:
        raise UnsafeUrlError("Only http and https URLs are allowed")
    if not parsed.hostname or parsed.username or parsed.password:
        raise UnsafeUrlError("A public hostname without embedded credentials is required")
    host = parsed.hostname.rstrip(".").lower()
    try:
        if not _is_public_ip(host):
            raise UnsafeUrlError("Private, local or reserved network destinations are not allowed")
    except ValueError:
        if host == "localhost" or host.endswith(".local"):
            raise UnsafeUrlError("Local hostnames are not allowed")
        resolve_public_ips(host)
    return parsed.geturl()


class TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []
        self.ignored_depth = 0

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag in {"script", "style", "noscript", "svg"}:
            self.ignored_depth += 1

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style", "noscript", "svg"} and self.ignored_depth:
            self.ignored_depth -= 1

    def handle_data(self, data: str) -> None:
        if not self.ignored_depth:
            cleaned = " ".join(data.split())
            if cleaned:
                self.parts.append(cleaned)

    def text(self) -> str:
        return "\n".join(self.parts)


def fetch_company_text(
    url: str,
    *,
    timeout_seconds: float = 10,
    max_bytes: int = 1_000_000,
    max_redirects: int = 3,
) -> tuple[str, str]:
    current_url = validate_public_url(url)
    with httpx.Client(timeout=timeout_seconds, follow_redirects=False) as client:
        for redirect_index in range(max_redirects + 1):
            # Re-resolve every hop immediately before the connection.
            current_url = validate_public_url(current_url)
            with client.stream(
                "GET",
                current_url,
                headers={
                    "User-Agent": "Promarkia-Community/0.1 (+local research fetch)",
                    "Accept": "text/html,text/plain;q=0.9",
                },
            ) as response:
                if response.status_code in {301, 302, 303, 307, 308}:
                    location = response.headers.get("location")
                    if not location or redirect_index >= max_redirects:
                        raise UnsafeUrlError("Too many or invalid redirects")
                    current_url = urljoin(current_url, location)
                    continue
                response.raise_for_status()
                content_type = response.headers.get("content-type", "").split(";", 1)[0].lower()
                if not any(content_type.startswith(allowed) for allowed in ALLOWED_CONTENT_TYPES):
                    raise UnsafeUrlError("Company URL must return HTML or plain text")
                chunks: list[bytes] = []
                size = 0
                for chunk in response.iter_bytes():
                    size += len(chunk)
                    if size > max_bytes:
                        raise UnsafeUrlError("Company page is larger than the configured limit")
                    chunks.append(chunk)
                body = b"".join(chunks).decode(response.encoding or "utf-8", errors="replace")
                if content_type == "text/plain":
                    return current_url, body[:100_000]
                parser = TextExtractor()
                parser.feed(body)
                text = parser.text()
                if not text:
                    raise UnsafeUrlError("Company page did not contain readable text")
                return current_url, text[:100_000]
    raise UnsafeUrlError("Company URL could not be fetched")

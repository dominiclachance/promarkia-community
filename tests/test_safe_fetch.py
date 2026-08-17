import socket

import pytest

from app.services.safe_fetch import TextExtractor, UnsafeUrlError, resolve_public_ips, validate_public_url


@pytest.mark.parametrize(
    "url",
    [
        "file:///etc/passwd",
        "http://localhost/admin",
        "http://127.0.0.1:8000",
        "http://10.0.0.1",
        "http://169.254.169.254/latest/meta-data",
        "http://user:pass@example.com",
    ],
)
def test_rejects_non_public_destinations(url):
    with pytest.raises(UnsafeUrlError):
        validate_public_url(url)


def test_resolver_rejects_mixed_public_and_private(monkeypatch):
    monkeypatch.setattr(
        socket,
        "getaddrinfo",
        lambda *args, **kwargs: [
            (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 0)),
            (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("127.0.0.1", 0)),
        ],
    )
    with pytest.raises(UnsafeUrlError):
        resolve_public_ips("example.test")


def test_resolver_accepts_public_address(monkeypatch):
    monkeypatch.setattr(
        socket,
        "getaddrinfo",
        lambda *args, **kwargs: [
            (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 0))
        ],
    )
    assert validate_public_url("https://example.test/path") == "https://example.test/path"


def test_html_extractor_ignores_script_and_style():
    parser = TextExtractor()
    parser.feed("<h1>Hello</h1><script>steal()</script><style>.x{}</style><p>World</p>")
    assert parser.text() == "Hello\nWorld"

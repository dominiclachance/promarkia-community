from __future__ import annotations

from app.config import Settings


def test_default_bind_is_loopback(tmp_path):
    settings = Settings(data_dir=tmp_path)

    assert settings.binds_loopback_only
    assert not settings.unsafe_allow_network_bind


def test_wildcard_bind_is_not_loopback(tmp_path):
    settings = Settings(data_dir=tmp_path, host="0.0.0.0")

    assert not settings.binds_loopback_only


def test_ipv6_loopback_is_allowed(tmp_path):
    settings = Settings(data_dir=tmp_path, host="::1")

    assert settings.binds_loopback_only

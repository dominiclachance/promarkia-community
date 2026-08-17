import json

from scripts.build_release_metadata import enrich_sbom
from scripts.verify_release_bundle import find_one


def test_sbom_platform_version_tracks_the_current_release_runtime(tmp_path):
    sbom = tmp_path / "sbom.json"
    sbom.write_text(
        json.dumps({"components": [{"type": "platform", "name": "CPython", "version": "old"}]}),
        encoding="utf-8",
    )
    enrich_sbom(sbom, [{
        "type": "platform",
        "name": "CPython",
        "version": "3.12.10",
        "license": "PSF-2.0",
        "purl": "pkg:generic/cpython@3.12.10",
        "homepage": "https://www.python.org/",
    }])
    component = json.loads(sbom.read_text(encoding="utf-8"))["components"][0]
    assert component["version"] == "3.12.10"
    assert component["purl"].endswith("@3.12.10")


def test_bundle_verifier_accepts_identical_resource_aliases(tmp_path):
    first = tmp_path / "Resources" / "sbom.cdx.json"
    second = tmp_path / "Frameworks" / "sbom.cdx.json"
    first.parent.mkdir()
    second.parent.mkdir()
    first.write_text("same", encoding="utf-8")
    second.write_text("same", encoding="utf-8")
    assert find_one(tmp_path, "sbom.cdx.json").read_text(encoding="utf-8") == "same"

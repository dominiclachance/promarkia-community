from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import json
import platform
import shutil
import ssl
import sys
import urllib.request
from pathlib import Path

from packaging.requirements import Requirement


ROOT = Path(__file__).resolve().parents[1]
LICENSE_DIR = ROOT / "THIRD_PARTY_LICENSES"
OPENSSL_LICENSE_URL = "https://raw.githubusercontent.com/openssl/openssl/openssl-3.0.15/LICENSE.txt"
OPENSSL_LICENSE_SHA256 = "7d5450cb2d142651b8afa315b5f238efc805dad827d91ba367d8516bc9d49e7a"
CPYTHON_LICENSE_SHA256 = "59688d8633ce27b1d8220f223b9520c4e039e4ba6ccceb345793a74fd5c155b9"

LICENSES = {
    "altgraph": "MIT",
    "annotated-doc": "MIT", "annotated-types": "MIT", "anyio": "MIT",
    "certifi": "MPL-2.0", "click": "BSD-3-Clause", "colorama": "BSD-3-Clause",
    "fastapi": "MIT", "h11": "MIT", "httpcore": "BSD-3-Clause",
    "httptools": "MIT", "httpx": "BSD-3-Clause", "idna": "BSD-3-Clause",
    "iniconfig": "MIT", "packaging": "Apache-2.0 OR BSD-2-Clause", "pluggy": "MIT",
    "macholib": "MIT", "pefile": "MIT",
    "pydantic": "MIT", "pydantic-core": "MIT", "pygments": "BSD-2-Clause",
    "pytest": "MIT", "python-dotenv": "BSD-3-Clause", "pyyaml": "MIT",
    "starlette": "BSD-3-Clause", "typing-inspection": "MIT", "typing-extensions": "PSF-2.0",
    "uvicorn": "BSD-3-Clause", "watchfiles": "MIT", "websockets": "BSD-3-Clause",
    "pyinstaller": "GPL-2.0-or-later WITH Bootloader-exception",
    "pyinstaller-hooks-contrib": "GPL-2.0-or-later AND Apache-2.0",
    "pywin32-ctypes": "BSD-3-Clause", "setuptools": "MIT",
}


def canonical(name: str) -> str:
    return name.lower().replace("_", "-").replace(".", "-")


def locked_distribution_names() -> set[str]:
    names = set()
    for lock_name in ("requirements.lock", "requirements-build.lock"):
        for raw_line in (ROOT / lock_name).read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#"):
                continue
            requirement = Requirement(line)
            if requirement.marker and not requirement.marker.evaluate():
                continue
            if len(requirement.specifier) != 1 or next(iter(requirement.specifier)).operator != "==":
                raise RuntimeError(f"Unsupported unlocked requirement in {lock_name}: {line}")
            names.add(canonical(requirement.name))
    unknown = sorted(names - set(LICENSES))
    if unknown:
        raise RuntimeError(f"Missing reviewed license mapping for locked distributions: {unknown}")
    return names


def copy_distribution_licenses() -> list[dict[str, object]]:
    # setup-python images do not consistently install CPython's LICENSE.txt.
    # Preserve the reviewed, hash-pinned copies before regenerating the tree.
    vendored_platform_licenses = {}
    for name in ("CPYTHON-LICENSE.txt", "OPENSSL-LICENSE.txt"):
        path = LICENSE_DIR / name
        if path.is_file():
            vendored_platform_licenses[name] = path.read_bytes()
    if LICENSE_DIR.exists():
        shutil.rmtree(LICENSE_DIR)
    LICENSE_DIR.mkdir(parents=True)

    required_names = locked_distribution_names()
    inventory = []
    for distribution in sorted(importlib.metadata.distributions(), key=lambda item: canonical(item.metadata["Name"] or "")):
        name = distribution.metadata["Name"] or "unknown"
        normalized = canonical(name)
        if normalized not in required_names:
            continue
        destination = LICENSE_DIR / f"{normalized}-{distribution.version}"
        copied = []
        for relative in distribution.files or []:
            filename = Path(str(relative)).name.lower()
            if not (filename.startswith("license") or filename.startswith("copying") or filename.startswith("notice")):
                continue
            source = Path(distribution.locate_file(relative))
            if not source.is_file():
                continue
            destination.mkdir(exist_ok=True)
            output = destination / Path(str(relative)).name
            shutil.copyfile(source, output)
            copied.append(str(output.relative_to(ROOT)).replace("\\", "/"))
        if not copied:
            raise RuntimeError(f"No license file found for installed distribution {name}=={distribution.version}")
        homepage = distribution.metadata.get("Home-page") or ""
        if not homepage:
            project_urls = distribution.metadata.get_all("Project-URL") or []
            homepage = project_urls[0].split(",", 1)[-1].strip() if project_urls else ""
        inventory.append({
            "type": "library",
            "name": name,
            "version": distribution.version,
            "license": LICENSES[normalized],
            "purl": f"pkg:pypi/{normalized}@{distribution.version}",
            "homepage": homepage,
            "licenseFiles": copied,
        })

    python_license = next(
        (candidate for candidate in (
            Path(sys.base_prefix) / "LICENSE.txt",
            Path(sys.base_prefix) / "LICENSE",
            Path(sys.executable).resolve().parent.parent / "LICENSE.txt",
        ) if candidate.is_file()),
        None,
    )
    python_license_bytes = (
        python_license.read_bytes()
        if python_license
        else vendored_platform_licenses.get("CPYTHON-LICENSE.txt", b"")
    ).replace(b"\r\n", b"\n")
    if hashlib.sha256(python_license_bytes).hexdigest() != CPYTHON_LICENSE_SHA256:
        python_license_bytes = vendored_platform_licenses.get(
            "CPYTHON-LICENSE.txt", b""
        ).replace(b"\r\n", b"\n")
    if hashlib.sha256(python_license_bytes).hexdigest() != CPYTHON_LICENSE_SHA256:
        raise RuntimeError("Reviewed CPython license is unavailable or changed")
    (LICENSE_DIR / "CPYTHON-LICENSE.txt").write_bytes(python_license_bytes)

    installed_names = {canonical(str(item["name"])) for item in inventory}
    missing = sorted(required_names - installed_names)
    if missing:
        raise RuntimeError(f"Locked build distributions are not installed: {missing}")

    try:
        with urllib.request.urlopen(OPENSSL_LICENSE_URL, timeout=30) as response:
            openssl_license = response.read()
    except OSError:
        openssl_license = vendored_platform_licenses.get("OPENSSL-LICENSE.txt", b"")
    if hashlib.sha256(openssl_license).hexdigest() != OPENSSL_LICENSE_SHA256:
        raise RuntimeError("Pinned OpenSSL license hash mismatch")
    (LICENSE_DIR / "OPENSSL-LICENSE.txt").write_bytes(openssl_license)
    inventory.extend([
        {
            "type": "platform",
            "name": "CPython",
            "version": platform.python_version(),
            "license": "PSF-2.0",
            "purl": f"pkg:generic/cpython@{platform.python_version()}",
            "homepage": "https://www.python.org/",
            "licenseFiles": ["THIRD_PARTY_LICENSES/CPYTHON-LICENSE.txt"],
        },
        {
            "type": "library",
            "name": "OpenSSL",
            "version": ssl.OPENSSL_VERSION.split()[1],
            "license": "Apache-2.0",
            "purl": f"pkg:generic/openssl@{ssl.OPENSSL_VERSION.split()[1]}",
            "homepage": "https://www.openssl.org/",
            "licenseFiles": ["THIRD_PARTY_LICENSES/OPENSSL-LICENSE.txt"],
        },
    ])
    return inventory


def enrich_sbom(path: Path, inventory: list[dict[str, object]]) -> None:
    sbom = json.loads(path.read_text(encoding="utf-8"))
    by_name = {canonical(str(item["name"])): item for item in inventory}
    components = sbom.setdefault("components", [])
    existing_names = {canonical(str(component.get("name", ""))) for component in components}
    for item in inventory:
        normalized = canonical(str(item["name"]))
        if normalized not in existing_names:
            components.append({
                "type": item.get("type", "library"),
                "name": item["name"],
                "version": item["version"],
            })
            existing_names.add(normalized)
    for component in components:
        item = by_name.get(canonical(str(component.get("name", ""))))
        if not item:
            continue
        component["name"] = item["name"]
        component["version"] = item["version"]
        component["purl"] = item["purl"]
        component["licenses"] = [{"expression": item["license"]}]
        if item["homepage"]:
            component["externalReferences"] = [{"type": "website", "url": item["homepage"]}]
    path.write_text(json.dumps(sbom, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--sbom", type=Path, default=ROOT / "sbom.cdx.json")
    args = parser.parse_args()
    inventory = copy_distribution_licenses()
    (LICENSE_DIR / "inventory.json").write_text(
        json.dumps({"components": inventory}, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    (LICENSE_DIR / "README.md").write_text(
        "# Bundled third-party licenses\n\n"
        "These notices are generated from the exact installed release environment. "
        "They include CPython, OpenSSL, PyInstaller and the Python distributions used "
        "to build the desktop application. See `inventory.json` for versions, SPDX "
        "expressions, package URLs and source links.\n",
        encoding="utf-8",
    )
    enrich_sbom(args.sbom, inventory)
    print(json.dumps({"components": len(inventory), "licenseDirectory": str(LICENSE_DIR)}))


if __name__ == "__main__":
    main()

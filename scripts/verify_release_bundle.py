from __future__ import annotations

import argparse
import json
from pathlib import Path


REQUIRED_BASENAMES = {
    "LICENSE",
    "THIRD_PARTY_NOTICES.md",
    "sbom.cdx.json",
    "inventory.json",
    "CPYTHON-LICENSE.txt",
    "OPENSSL-LICENSE.txt",
}


def canonical(name: str) -> str:
    return name.lower().replace("_", "-").replace(".", "-")


def find_one(root: Path, name: str) -> Path:
    matches = [path for path in root.rglob(name) if path.is_file()]
    if len(matches) != 1:
        raise SystemExit(f"Expected exactly one {name} in {root}; found {len(matches)}")
    return matches[0]


def component_map(document: dict) -> dict[tuple[str, str], dict]:
    return {
        (canonical(str(item.get("name", ""))), str(item.get("version", ""))): item
        for item in document.get("components", [])
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("bundle", type=Path)
    args = parser.parse_args()
    if not args.bundle.exists():
        raise SystemExit(f"Bundle path does not exist: {args.bundle}")
    names = {path.name for path in args.bundle.rglob("*") if path.is_file()}
    missing = sorted(REQUIRED_BASENAMES - names)
    if missing:
        raise SystemExit(f"Release bundle is missing required legal metadata: {missing}")

    bundled_inventory_path = find_one(args.bundle, "inventory.json")
    bundled_sbom_path = find_one(args.bundle, "sbom.cdx.json")
    bundled_inventory = json.loads(bundled_inventory_path.read_text(encoding="utf-8"))
    bundled_sbom = json.loads(bundled_sbom_path.read_text(encoding="utf-8"))
    expected_inventory = json.loads(
        (Path(__file__).resolve().parents[1] / "THIRD_PARTY_LICENSES" / "inventory.json").read_text(
            encoding="utf-8"
        )
    )

    bundled_components = component_map(bundled_inventory)
    expected_components = component_map(expected_inventory)
    if bundled_components.keys() != expected_components.keys():
        missing_components = sorted(expected_components.keys() - bundled_components.keys())
        extra_components = sorted(bundled_components.keys() - expected_components.keys())
        raise SystemExit(
            f"Bundled inventory differs from generated release inventory; "
            f"missing={missing_components}, extra={extra_components}"
        )

    sbom_components = component_map(bundled_sbom)
    inventory_root = bundled_inventory_path.parent.parent
    for key, item in bundled_components.items():
        sbom_item = sbom_components.get(key)
        if not sbom_item:
            raise SystemExit(f"SBOM is missing inventory component {key}")
        expressions = {
            entry.get("expression")
            for entry in sbom_item.get("licenses", [])
            if isinstance(entry, dict)
        }
        if item.get("license") not in expressions:
            raise SystemExit(f"SBOM license mismatch for {key}: {expressions}")
        for relative in item.get("licenseFiles", []):
            license_path = (inventory_root / relative).resolve()
            if inventory_root.resolve() not in license_path.parents or not license_path.is_file():
                raise SystemExit(f"Missing or unsafe bundled license path for {key}: {relative}")

    print(
        f"Release bundle legal metadata verified: {args.bundle} "
        f"({len(bundled_components)} components)"
    )


if __name__ == "__main__":
    main()

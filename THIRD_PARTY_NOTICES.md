# Third-Party Notices

Promarkia Community is MIT-licensed. Its pinned Python dependencies retain their own licenses.
The authoritative machine-readable inventory is `sbom.cdx.json`.

## Runtime dependencies

| Package | Version | License |
|---|---:|---|
| annotated-doc | 0.0.5 | MIT |
| annotated-types | 0.8.0 | MIT |
| anyio | 4.14.2 | MIT |
| certifi | 2026.7.22 | MPL-2.0 |
| click | 8.4.2 | BSD-3-Clause |
| colorama | 0.4.6 | BSD |
| fastapi | 0.141.1 | MIT |
| h11 | 0.16.0 | MIT |
| httpcore | 1.0.9 | BSD-3-Clause |
| httptools | 0.8.0 | MIT |
| httpx | 0.28.1 | BSD-3-Clause |
| idna | 3.18 | BSD-3-Clause |
| pydantic | 2.13.4 | MIT |
| pydantic-core | 2.46.4 | MIT |
| python-dotenv | 1.2.3 | BSD-3-Clause |
| PyYAML | 6.0.3 | MIT |
| starlette | 1.6.0 | BSD-3-Clause |
| typing-inspection | 0.4.4 | MIT |
| typing-extensions | 4.16.0 | PSF-2.0 |
| uvicorn | 0.52.3 | BSD-3-Clause |
| watchfiles | 1.2.0 | MIT |
| websockets | 17.0.1 | BSD-3-Clause |

Development-only dependencies are also permissively licensed: pytest and pluggy (MIT),
iniconfig (MIT), packaging (Apache-2.0 or BSD-2-Clause), and Pygments (BSD-2-Clause).

Final desktop and Docker artifacts include `THIRD_PARTY_LICENSES/`, generated from the exact build
environment. It contains CPython, OpenSSL, certifi/MPL, PyInstaller bootloader and installed Python
distribution license texts. `THIRD_PARTY_LICENSES/inventory.json` records versions, SPDX
expressions, package URLs, source/homepage references and bundled notice paths. Release CI fails if
a required installed distribution has no discoverable license file.

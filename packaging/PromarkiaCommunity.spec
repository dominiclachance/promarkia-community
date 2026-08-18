# -*- mode: python ; coding: utf-8 -*-
import os
import sys
from PyInstaller.utils.hooks import collect_all, collect_submodules

repo_root = os.path.abspath(os.path.join(SPECPATH, ".."))

datas = [
    (os.path.join(repo_root, "LICENSE"), "."),
    (os.path.join(repo_root, "THIRD_PARTY_NOTICES.md"), "."),
    (os.path.join(repo_root, "THIRD_PARTY_LICENSES"), "THIRD_PARTY_LICENSES"),
    (os.path.join(repo_root, "sbom.cdx.json"), "."),
]
binaries = []
hiddenimports = []

# Squad tools are persisted as source code and imported at runtime, so their
# dependencies are not visible to PyInstaller's static analysis.
runtime_packages = [
    "alembic", "autogenstudio", "promarkia_local",
    "autogen_agentchat", "autogen_core", "autogen_ext",
    "composio", "composio_client", "google.genai", "PIL", "imageio_ffmpeg",
    "matplotlib", "seaborn", "sklearn", "pptx", "bs4", "playwright",
    "pandas", "numpy", "openai", "anthropic", "azure.ai.documentintelligence",
    "markdownify", "markitdown", "mammoth", "openpyxl", "pdfplumber",
]
for package in runtime_packages:
    package_datas, package_binaries, package_hidden = collect_all(package)
    datas += package_datas
    binaries += package_binaries
    hiddenimports += package_hidden
hiddenimports += collect_submodules("uvicorn")

a = Analysis(
    [os.path.join(repo_root, "packaging", "desktop_entry.py")],
    pathex=[os.path.join(repo_root, "apps", "api"), repo_root],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[os.path.join(repo_root, "packaging", "runtime_hook.py")],
    excludes=[],
    noarchive=False,
    optimize=1,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="PromarkiaCommunity",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    disable_windowed_traceback=False,
)

bundle = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name="PromarkiaCommunity",
)

if sys.platform == "darwin":
    app = BUNDLE(
        bundle,
        name="Promarkia Community.app",
        icon=None,
        bundle_identifier="com.agentixlabs.promarkia.community",
        info_plist={
            "CFBundleDisplayName": "Promarkia Community",
            "NSHighResolutionCapable": True,
        },
    )

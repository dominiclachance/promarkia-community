# -*- mode: python ; coding: utf-8 -*-
import os
import sys

repo_root = os.path.abspath(os.path.join(SPECPATH, ".."))

a = Analysis(
    [os.path.join(repo_root, "app", "desktop.py")],
    pathex=[repo_root],
    binaries=[],
    datas=[
        (os.path.join(repo_root, "app", "static"), "app/static"),
        (os.path.join(repo_root, "LICENSE"), "."),
        (os.path.join(repo_root, "THIRD_PARTY_NOTICES.md"), "."),
        (os.path.join(repo_root, "sbom.cdx.json"), "."),
    ],
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
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

# Release Process

1. Freeze the release commit and confirm no production credentials, customer data, Firebase, Firestore, Stripe, or cloud control-plane code is present.
2. Build the frontend and run Python tests, ESLint, Bandit, `npm audit`, `pip-audit`, secret scanning, Docker QA, and a real Ollama smoke test.
3. Generate the CycloneDX SBOM and third-party license inventory from the exact release environment.
4. Build Windows and macOS artifacts on their native runners. Verify each bundle contains the UI, legal metadata, ffmpeg, database migrations, and all dynamic squad dependencies.
5. Smoke-test health, 16-squad capabilities, first-run database initialization, dialogs, and a real model conversation.
6. Update `CHANGELOG.md`, screenshots, tutorial, known limitations, and artifact checksums.
7. Create and push `vMAJOR.MINOR.PATCH`. The release workflow publishes the Windows installer, macOS DMG, SBOM, notices, and checksums.
8. Download every published artifact, verify checksums, install on clean machines, and repeat the smoke tests.
9. Label unsigned preview artifacts clearly until Windows code signing and Apple notarization are configured.

PyInstaller is not a cross-compiler; Windows and macOS packages must be built and tested on their native GitHub-hosted operating systems.

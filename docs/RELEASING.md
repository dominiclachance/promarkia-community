# Release Process

1. Freeze the release commit and confirm no production credentials, customer data, Firebase, Firestore, Stripe, or cloud control-plane code is present.
2. Build the frontend and run Python tests, ESLint, Bandit, `npm audit`, `pip-audit`, secret scanning, Docker QA, and a real Ollama smoke test.
3. Generate the CycloneDX SBOM and third-party license inventory from the exact release environment.
4. Build Windows and macOS artifacts on their native runners. Verify each bundle contains the UI, legal metadata, ffmpeg, database migrations, and all dynamic squad dependencies.
5. Smoke-test health, 16-squad capabilities, first-run database initialization, dialogs, and a real model conversation.
6. Update `CHANGELOG.md`, screenshots, tutorial, known limitations, and artifact checksums.
7. Create and push `vMAJOR.MINOR.PATCH`. The release workflow publishes the Windows installer, macOS DMG, SBOM, notices, and checksums.
8. Download every published artifact, verify checksums, install on clean machines, and repeat the smoke tests.
9. Tagged releases must be code-signed on Windows and signed, notarized, and stapled on macOS. The workflow permits unsigned artifacts only for manual test runs.

## Release-signing credentials

Configure these repository Actions secrets before creating the next `v*` tag. The release workflow fails closed when any tagged-release credential set is missing or incomplete.

Windows:

- `WINDOWS_CERTIFICATE_BASE64`: base64-encoded PFX code-signing certificate.
- `WINDOWS_CERTIFICATE_PASSWORD`: PFX password.

macOS and Apple notarization:

- `MACOS_CERTIFICATE_P12_BASE64`: base64-encoded Developer ID Application certificate in P12 format.
- `MACOS_CERTIFICATE_PASSWORD`: P12 password.
- `MACOS_SIGNING_IDENTITY`: exact Developer ID Application identity reported by `security find-identity`.
- `APPLE_API_KEY_P8`: App Store Connect API private key contents.
- `APPLE_API_KEY_ID`: App Store Connect API key ID.
- `APPLE_API_ISSUER_ID`: App Store Connect API issuer ID.

The workflow signs the packaged Windows executable and NSIS installer, verifies both signatures, signs the macOS app and DMG, submits the DMG to Apple's notary service, staples the ticket, and validates it before upload. Temporary certificates, API keys, and keychains are removed from the runner even if the build fails.

The already-published `v0.1.0` artifacts are unsigned previews. Do not replace them in place; ship signed/notarized artifacts under the next version tag after credentials are configured and a clean-machine review passes.

PyInstaller is not a cross-compiler; Windows and macOS packages must be built and tested on their native GitHub-hosted operating systems.

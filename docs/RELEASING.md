# Release Process

1. Confirm the publication gate in `docs/LEGAL_PROVENANCE_REVIEW.md` is signed off.
2. Update `CHANGELOG.md`, version metadata, dependency locks, SBOM, and screenshots.
3. Run tests, Bandit, dependency audit, Docker E2E, and a real local Ollama smoke test.
4. Commit a clean tree and create a signed `vMAJOR.MINOR.PATCH` tag.
5. Push the tag. GitHub Actions builds Windows and macOS artifacts on their native runners,
   smoke-tests each bundle, creates checksums, and publishes the GitHub release.
6. Download both artifacts on clean machines and verify install, first launch, mock campaign,
   approval, uninstall, and retained/deleted data behavior.
7. Sign and notarize production artifacts when Agentix Labs certificates are available. Unsigned
   preview artifacts must be labeled clearly and are not promoted as generally available.

PyInstaller is not a cross-compiler, so Windows and macOS packages are intentionally built on
their respective GitHub-hosted operating systems.


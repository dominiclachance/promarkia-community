# Changelog

All notable changes follow Keep a Changelog and Semantic Versioning.

## [0.1.0] - 2026-08-18

### Added

- General Chat and all 15 Promarkia specialist squads in a local, single-owner workspace.
- Interactive multi-agent conversations, squad routing, local history, run records, uploads,
  generated artifacts, and Launchpad workflows.
- Ollama, OpenAI, and OpenAI-compatible model providers with encrypted local credential storage.
- Bring-your-own integrations and stdio or Streamable HTTP MCP servers.
- Image, video, research, document, spreadsheet, browser, email, calendar, CRM, WordPress, and
  social tools used by configured squads.
- Fail-closed, one-time approvals for supported external mutations, including publishing and
  sending actions.
- One-time and recurring local schedules, plus a local token and estimated-cost ledger with
  warning and optional hard-cap controls.
- Loopback-only WebUI/API, SQLite and local-file persistence, CLI diagnostics, Docker, Windows
  installer, and macOS DMG.
- Native desktop smoke tests, cross-platform CI, CycloneDX SBOM, dependency inventory, license
  notices, checksums, security review, privacy documentation, and release automation.

### Security

- Loopback binding by default, explicit acknowledgement for non-loopback use, encrypted secrets,
  redacted API and approval views, mutation classification, one-time approval replay protection,
  dependency scanning, secret scanning, and exact release-bundle verification.

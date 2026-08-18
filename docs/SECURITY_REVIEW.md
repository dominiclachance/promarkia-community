# Application Security Review — Full Local Workspace

**Target:** full local-parity branch
**Deployment model:** one trusted owner, loopback-only
**Status:** pass with platform-validation condition

## Verified controls

- no billing, Stripe, Firebase, Firestore, managed identity, or cloud multi-tenant database
- loopback bind by default; non-loopback bind requires an explicit unsafe acknowledgement
- encrypted local vault for model, integration, and MCP secrets
- secrets are injected per run and excluded from API listings and approval previews
- supported external mutations fail closed and require one matching, one-time approval
- local scheduler preserves the approval requirement for external writes
- arbitrary MCP servers are opt-in and visible in local configuration
- all exported squad tools are cross-platform localized and syntax-validated
- release bundle includes exact dependency inventory, license texts, and CycloneDX SBOM
- Python and JavaScript dependency audits report zero known vulnerabilities at the reviewed lock state

## Residual risks

1. There is no network login. Any process or user that can reach the loopback service under the same machine trust boundary may use the workspace.
2. Custom MCP servers, compatible model endpoints, browser tools, remote pages, and third-party integrations are separate trust domains.
3. The approval wrapper covers the classified built-in mutation tools. New mutation tools must be classified and tested before release.
4. Generated content and agent-selected tool arguments can be wrong or unsafe; human review remains mandatory.
5. Local cost accounting is an estimate and cannot prevent charges created outside Promarkia.
6. Media publication may require an operator-provided public asset URL, which expands the network threat model.

## Review evidence

- Python parity suite: 8 passed
- frontend lint and production build: passed; largest lazy chunk 361.47 kB
- Bandit: zero unsuppressed findings; the sole suppression is the provider connectivity request immediately after an HTTP/HTTPS allow-list check
- `npm audit`: zero known vulnerabilities
- `pip-audit`: zero known vulnerabilities in `requirements.lock`
- Docker: pinned dependency image, non-root runtime, healthy API and complete UI QA
- frozen Windows application: launched without a console, initialized SQLite/managers, and returned a healthy API response
- real Ollama `qwen2.5:7b-instruct` conversation: completed with persisted messages and usage receipt
- built-in mutation classification: 21 actions covered by one-time approval/replay tests
- release metadata: 144-component inventory, licenses, notices, and CycloneDX SBOM verified

## Remaining platform condition

The macOS DMG must be built and smoke-tested by the pinned `macos-14` GitHub release job before publishing that asset. This is a platform-validation condition, not an application-security finding.

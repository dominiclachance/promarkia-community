# Security

## Supported version

Security updates target the latest Community release.

## Report a vulnerability

Do not open a public issue for a suspected vulnerability. Email `security@agentixlabs.com` with reproduction steps, impact, and affected version. Never include real credentials or customer data.

## Security model

- Community is a single-owner desktop/local service with no network authentication layer.
- It binds to loopback by default and rejects non-loopback binds unless the operator explicitly acknowledges the risk.
- API keys and integration/MCP credentials are encrypted in the local vault and injected only into runs that need them.
- Supported external write actions are guarded by a fail-closed, one-time approval fingerprint.
- Local usage limits can stop new model work but do not control charges incurred directly with third-party providers outside Promarkia.
- Model output, tool output, remote webpages, documents, MCP servers, and integration responses are untrusted input.

## Operator responsibilities

- Keep the workspace on a trusted operating-system account and encrypt the disk.
- Do not expose port 8788 to a LAN or the internet without adding a reviewed authentication proxy.
- Grant third-party integrations the minimum permissions needed.
- Review every external action, factual claim, recipient, URL, and uploaded file before approval.
- Keep provider libraries and release binaries current.
- Treat custom MCP servers and OpenAI-compatible endpoints as code/data trust decisions.

The engineering review is in `docs/SECURITY_REVIEW.md`; release bundles include a CycloneDX SBOM and exact third-party notices.

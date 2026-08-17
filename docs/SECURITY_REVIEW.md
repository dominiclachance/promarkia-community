# Application Security Review

**Review date:** 2026-08-17  
**Target:** Promarkia Community 0.1  
**Verdict:** Clear for single-user loopback beta; not approved as a public-network service

## Automated evidence

- 21 tests pass.
- Bandit: zero findings after remediation.
- `pip-audit`: zero known vulnerabilities in the pinned dependency set.
- CycloneDX SBOM: 26 components, zero reported vulnerabilities.
- Secret/production-identifier scan: only the deliberate fake key in the redaction test.
- Exact hash comparison: no Community file matches production source.
- Dangerous sink scan: no `eval`, shell execution, unsafe deserialization, or DOM `innerHTML`.

## Controls verified

- Loopback Host validation blocks DNS-rebinding Host headers.
- Cross-site mutating requests are rejected by Origin and Fetch Metadata checks.
- CSP, frame denial, no-referrer, and MIME-sniffing headers are emitted.
- Company URLs reject credentials, non-HTTP schemes, and private, loopback, link-local,
  multicast, reserved, or unresolved targets; every redirect is revalidated.
- Response type, byte size, redirect count, and request duration are bounded.
- Website content is delimited as untrusted model context.
- Campaign IDs are UUIDs and artifact reads use a fixed allowlist.
- Provider credentials remain process-only and are redacted from errors and receipts.
- No publishing tool, shell execution, plugin execution, account system, or telemetry exists.
- Docker and desktop builds run the application as a local-only service.

## Residual risks

1. DNS validation and socket connection are distinct steps. Keep the application loopback-only;
   harden connection-time IP pinning before offering the fetcher to untrusted remote users.
2. The background worker is in-process. A restart marks interrupted work failed and requires a
   manual retry; it is not a durable multi-worker queue.
3. Local campaign data is plaintext on disk and inherits host-account permissions. Full-disk
   encryption and operating-system access controls remain the user's responsibility.
4. Model output may contain factual errors, unsafe links, or unsuitable claims. Approval is a
   workflow state, not a legal/compliance certification.

## Release conditions

- Preserve loopback defaults in Docker and desktop installers.
- Run tests, Bandit, `pip-audit`, secret scan, and SBOM generation on every pull request.
- Do not add browser-accessible state-changing endpoints without the local-origin guard.
- Obtain a separate independent security review before any hosted or LAN-accessible deployment.


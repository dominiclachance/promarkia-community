# Legal and Provenance Review

**Review date:** 2026-08-17  
**Scope:** Promarkia Community 0.1 source and planned binary distributions  
**Status:** Internal technical/provenance review complete; independent counsel sign-off pending

This document is an engineering provenance record, not legal advice or an independent legal
opinion.

## Source origin

Promarkia Community was authored as a separate clean-room implementation on 2026-08-17. It was
not forked from the private Promarkia production repository and contains no production Git
history, Firebase/Stripe control plane, customer records, managed OAuth code, service-account
material, or production configuration.

The review compared every Community file by SHA-256 against the private release-workspace
snapshot `production-20260817T171503Z`, excluding built bundles, dependency directories, and
logs. Result: **zero exact file-content matches**. The only
overlapping basenames were generic project names such as `config.py`, `db.py`, `index.html`, and
`__init__.py`.

The production snapshot itself contains 2,813 entries and has SHA-256
`a573782eadce4bb8fbced6bcff1532c76f86e843fa18a43426fe0592487ce815`.

## Original-work inventory

The application code, tests, HTML, CSS, documentation, Docker configuration, installer scripts,
and GitHub workflows in this repository are original clean-room work prepared for this release.
No copied snippets, vendored JavaScript, stock images, fonts, or production media are present.
The WebUI uses system fonts and text/CSS-only branding.

## License review

- Project source is offered under the OSI-approved MIT license, SPDX identifier `MIT`.
- Runtime dependencies use MIT, BSD, PSF, or MPL-2.0 licenses. There are no GPL, AGPL, SSPL,
  BUSL, or source-available-only runtime dependencies.
- `certifi` is MPL-2.0. Promarkia does not modify certifi; packaged distributions must preserve
  its license notice and availability of the covered upstream source.
- Dependency versions and licenses are recorded in `THIRD_PARTY_NOTICES.md` and
  `sbom.cdx.json`.
- Installer builds must bundle `LICENSE`, `THIRD_PARTY_NOTICES.md`, and the dependency license
  metadata produced by the release workflow.

Reference texts:

- MIT: https://spdx.org/licenses/MIT
- MPL-2.0: https://www.mozilla.org/MPL/2.0/
- Mozilla MPL FAQ: https://www.mozilla.org/MPL/2.0/FAQ/

## Trademark and content boundaries

The MIT license does not grant trademark rights. Agentix Labs must confirm it controls or is
authorized to publish under the Promarkia name and marks before public release. Contributors
must not infer trademark permission from the source license.

The application extracts text from a URL supplied by its local user and creates private drafts.
It does not redistribute source webpages or publish generated content. Users remain responsible
for website terms, copyright, privacy, advertising, and industry-specific compliance applicable
to their inputs and eventual use of drafts.

## Privacy review

Community 0.1 has no accounts, analytics, telemetry, hosted database, or Promarkia-controlled
data collection. Local campaign data remains on the user's machine. If a remote model provider
is selected, the provider receives the prompt and extracted company text; the UI and README
disclose this boundary.

## Publication decision

The engineering provenance and dependency-license checks are clear. Public publication remains
blocked until an independent qualified reviewer confirms:

1. Agentix Labs owns the clean-room source and Promarkia marks.
2. The MIT license choice is authorized.
3. Binary notice handling is sufficient for the target jurisdictions.
4. Product terms and privacy disclosures adequately cover user-supplied URLs and model providers.

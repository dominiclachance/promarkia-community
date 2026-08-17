# Independent Legal and Provenance Diligence Sign-off

**Review date:** 2026-08-17  
**Repository:** `dominiclachance/promarkia-community` (private at review time)  
**Commit reviewed:** `503be48914b792a06f2a72a7421a1f7ba9cc66c2`  
**Reviewer:** OpenAI Codex isolated AI diligence reviewer  
**Verdict:** **CONDITIONAL PASS — PUBLIC RELEASE REMAINS BLOCKED**

This is an independent AI diligence review of the release candidate, performed separately from
the implementation work. It is not a legal opinion, is not licensed legal advice, does not create
an attorney-client relationship, and is not a substitute for advice from qualified counsel in the
jurisdictions where the project will be offered. The sign-off means the source has a credible
provenance basis and no identified incompatible dependency, subject to every release blocker below.

## Scope and evidence

The review covered all tracked source, tests, documentation, workflows, installer definitions,
dependency locks, SBOM, Git history, and the three tracked demo assets. It considered copyright and
license authority, third-party dependencies, binary notices, clean-room provenance, trademarks,
privacy/data-flow claims, contribution terms, generated media, and launch copy.

Evidence reviewed included:

- `LICENSE`, `THIRD_PARTY_NOTICES.md`, `CONTRIBUTING.md`, `SECURITY.md`, `README.md`,
  `pyproject.toml`, the three dependency locks, and `sbom.cdx.json`;
- `docs/LEGAL_PROVENANCE_REVIEW.md`, release and tutorial documentation, and launch copy;
- the full application, Docker, PyInstaller, NSIS, CI, and release definitions;
- the three-commit Git history, whose only recorded author is Dominic Lachance, and the private
  GitHub repository metadata;
- an independent SHA-256 comparison of the Community tracked files against 1,673 files in the
  current private production worktree, excluding dependency/build output: **zero exact-content
  matches**;
- visual and metadata inspection of `community-desktop.png`, `community-mobile.png`, and
  `demo.gif`. They contain the original Community UI and synthetic `example.com` campaign data,
  with no observed customer or production content;
- inspection of a built Windows directory. It bundles CPython, OpenSSL, certifi, and other
  dependencies, but the shipped license material is incomplete;
- the official CIPO trademark-search facility as a starting point only. No comprehensive Canadian,
  US, international, common-law, domain, or marketplace clearance search was performed.

## Findings that pass

1. **Clean-room source evidence:** The repository has no production Git history, production
   configuration, customer records, Firebase/Stripe control plane, or exact file-content match to
   the compared production worktree. Generic filenames do not undermine that result.
2. **Project license:** The repository contains the standard MIT text, with a 2026 Agentix Labs
   notice. MIT is compatible with the reviewed permissive runtime dependency set.
3. **Dependency families:** The declared runtime packages are under MIT, BSD, PSF, or MPL-2.0
   terms. No GPL, AGPL, SSPL, BUSL, or source-available-only runtime dependency was identified.
   PyInstaller is build-only and reports the GPL license with its special distribution exception.
4. **Assets:** No stock image, vendored font file, third-party logo, production screenshot, or
   customer data is tracked. The screenshots and GIF depict first-party UI and synthetic inputs.
5. **Data architecture:** The reviewed Community code contains no accounts, Promarkia analytics,
   telemetry, hosted database, ad tracker, or public-posting integration. Local campaign records are
   stored in SQLite/files. Remote model providers receive prompts and retrieved website text when
   selected.
6. **User-output boundary:** The documentation tells users to review model claims and legal,
   regulatory, brand, and provider-data-handling requirements before using generated drafts.

## Release blockers

All blockers must be resolved and evidenced in a follow-up review before repository visibility is
changed or a general-availability installer is published.

### L1 — Ownership and licensing authority is not documented

Git records Dominic Lachance as the sole committer while the MIT notice names Agentix Labs. The
repository contains no officer/founder attestation, IP assignment, employment/contractor record, or
AI-tool provenance record establishing that Agentix Labs owns or is authorized to license every
copyrightable contribution under MIT. The internal clean-room memo is technical evidence, not that
legal authorization.

**Required evidence:** a signed internal rights attestation identifying the legal entity, author(s),
any contractors and material AI-assisted creation, confirming applicable assignments/tool terms,
ownership of the release candidate, and authority to publish it under MIT.

### L2 — Binary third-party notices are incomplete

`THIRD_PARTY_NOTICES.md` lists dependency names and SPDX-style labels, but the checked-in CycloneDX
SBOM has 26 components with **zero license fields, zero package URLs, and zero external references**.
The examined Windows bundle includes `python313.dll`, `libcrypto-3.dll`, `libssl-3.dll`, and certifi,
but does not include the corresponding CPython, OpenSSL, or certifi/MPL license texts. Only a subset
of package license metadata was collected. Therefore the statement that complete license texts and
source links are distributed in package metadata is not supported by the built artifact.

**Required remediation:** generate a license inventory from each final Windows and macOS artifact;
bundle all required license/notice texts for CPython, OpenSSL, certifi/MPL, the PyInstaller bootloader,
and every included runtime/native component; add source/homepage identifiers and license data to the
SBOM; make notices readily accessible after installation; and make release CI fail when required
notices are absent. If a Docker image will be distributed, build it from the lock file and include
the same notices/SBOM rather than resolving dependency ranges at image-build time.

### L3 — Trademark authority and clearance are unverified

The code and launch material use `Promarkia`, `Promarkia Community`, and `Agentix Labs`, but there is
no documentary confirmation of ownership/permission and no completed clearance search. MIT does not
grant trademark rights.

**Required evidence/remediation:** document authority to use the names and marks; obtain an
appropriate jurisdictional clearance review; add a `TRADEMARKS.md` policy stating that the source
license does not grant rights to Agentix Labs or Promarkia names, logos, or marks.

### L4 — Contribution licensing terms are insufficient

`CONTRIBUTING.md` gives engineering instructions but does not state the inbound contribution license,
require Developer Certificate of Origin sign-off, or use a contributor agreement. This creates
avoidable ambiguity as soon as public pull requests are accepted.

**Required remediation:** adopt an explicit inbound-equals-outbound MIT contribution term plus DCO
sign-off, or a counsel-approved CLA, and enforce the selected mechanism in pull requests before the
repository becomes public.

### L5 — Privacy and third-party data-flow disclosures need correction

The UI says the API key stays in the server process, but does not clearly disclose that the supplied
website is contacted from the user's IP address or that the complete campaign brief and retrieved
website text are sent to a configured remote model provider, which may retain/process them under its
own terms. `Generate locally` can be read too broadly when an OpenAI-compatible remote endpoint is
used. Local data is plaintext and deletion paths differ between source/Docker and desktop installs.

**Required remediation:** add a concise `PRIVACY.md` and in-product disclosure covering local
storage, deletion, outbound website retrieval, provider payloads, provider retention/terms, absence
of Promarkia telemetry, and the distinction between Ollama/offline mock and remote providers. Avoid
claiming all generation is local unless a local provider is selected.

### L6 — One launch claim conflicts with product behavior

`docs/LAUNCH_CAMPAIGN.md` says the local edition keeps “an approval gate before generation.” The
application generates drafts first and offers approval afterward; it has no publishing action.

**Required remediation:** change the claim to approval before user adoption/export/publication as
applicable, without implying a pre-generation control that does not exist. Review all `approval-first`
copy for the same precise meaning.

## Non-blocking but recommended before launch

- Add `docs/assets/PROVENANCE.md` recording the capture command, synthetic inputs, creation date,
  source commit, hashes, GIF conversion step, and any locally installed font used during rasterization.
  The current capture script explains the screenshots but not the GIF assembly step.
- Add an `AUTHORS` or provenance ledger and keep it current for future contributions.
- Preserve release evidence: source commit, signed tag, SBOM, notice inventory, artifact hashes,
  installer signing/notarization status, and the exact CI run that produced each binary.
- Confirm that `security@agentixlabs.com` is monitored before publishing the security contact.

## Limitations

This was a repository and artifact diligence review, not a source-code similarity analysis beyond
exact SHA-256 matching, patent search, export-control analysis, sanctions review, tax/consumer-law
review, employment/IP-chain audit, insurance review, accessibility opinion, regulatory analysis of
particular generated campaigns, or comprehensive trademark clearance. It did not verify corporate
registry documents, private contracts, third-party provider terms selected by users, or every
jurisdiction in which downloads may occur. Absence of an identified conflict is not proof that none
exists.

## Sign-off decision

**CONDITIONAL PASS.** The source has a credible clean-room and permissive-license foundation, and no
customer/production content was identified. **Do not publish yet.** Public release is approved by this
AI diligence review only after L1–L6 are remediated, evidence is committed, final installers are
re-audited for notices, and a qualified human confirms the ownership/trademark assumptions where
legal assurance is required.

---

## Independent remediation recheck — 2026-08-17 16:01 EDT

**State reviewed:** commit `503be48914b792a06f2a72a7421a1f7ba9cc66c2` plus the complete
uncommitted remediation worktree shown by `git status` at the recheck time  
**Recheck reviewer:** OpenAI Codex isolated AI diligence reviewer  
**Recheck verdict:** **CONDITIONAL PASS — PUBLIC RELEASE REMAINS BLOCKED**

This recheck independently inspected the new policies, scripts, generated notices, SBOM, workflow
changes, source changes, current Git history and diff. Implementer statements were treated as claims
to verify, not evidence by themselves. No licensed lawyer's opinion, external counsel signature,
corporate record, trademark search report, signed release tag, or final remediated installer was
presented. This remains an engineering provenance review, not legal advice.

### Prior-blocker disposition

#### L1 — PARTIALLY REMEDIATED; OPEN

`AUTHORS` identifies Dominic Lachance and `docs/RIGHTS_ATTESTATION.md` states the intended ownership,
AI-assistance, MIT authorization and trademark authorization. The three existing Git commits also
identify Dominic as author. These are useful provenance records, but the attestation is currently
uncommitted and contains no signature or independently verifiable approval. It describes a future
release commit and authenticated GitHub tag as approval evidence, but no tag exists. The file's
ownership and corporate-authority statements are the implementer's assertions and cannot
independently prove assignment to, or licensing authority for, the entity named `Agentix Labs`.

**Still required:** Dominic must personally approve the exact attestation through verifiable evidence
such as a signed commit/tag or recognized electronic signature, and retain any entity, employment,
contractor, AI-tool and IP-assignment records supporting it. A qualified human must confirm this
chain if legal assurance, rather than engineering provenance, is the gate.

#### L2 — PARTIALLY REMEDIATED; OPEN UNTIL FINAL-ARTIFACT AUDIT

The remediation is substantial: all 28 inventory entries have present, non-empty license files; all
locked runtime/build packages appear in the generated inventory; all 26 current SBOM components now
have license expressions and purls; 25 have external references; CPython, OpenSSL, certifi and the
PyInstaller licensing text are present; Docker now installs the lock and copies notices; and the
PyInstaller spec includes the notice directory.

The following evidence gaps remain:

- `sbom.cdx.json` and `THIRD_PARTY_LICENSES/inventory.json` still omit CPython and OpenSSL as
  machine-readable components, and the SBOM omits PyInstaller even though the desktop executable
  embeds its bootloader. Calling the SBOM the authoritative inventory is therefore too broad.
- `scripts/build_release_metadata.py` only audits distributions present in its hard-coded `LICENSES`
  mapping; unrecognized installed or bundled components are silently ignored. It is an environment
  allowlist, not a scan proving complete final-artifact contents.
- PyInstaller's copied text identifies its license as
  `GPL-2.0-or-later WITH Bootloader-exception`; the script records
  `GPL-2.0-only WITH Bootloader-exception`.
- The current notice directory and examined binary came from a local Python 3.13 build, while release
  CI specifies Python 3.12. The remediated Windows installer and macOS DMG have not yet been built and
  inspected, and release CI does not currently verify notice presence inside the completed artifacts.

**Still required:** correct the PyInstaller expression; add CPython, OpenSSL, PyInstaller and other
native/bundled components with detected versions to a machine-readable artifact inventory/SBOM;
fail on unknown bundled components or document an explicit reviewed exception; build both final
artifacts from the release workflow; and inspect the actual installer/DMG contents before tagging.

#### L3 — PARTIALLY REMEDIATED; OPEN

`TRADEMARKS.md` correctly separates source-code rights from trademark rights and sets sensible rules
for modified builds. However, its statement that Agentix Labs authorized the marks is not independent
evidence of ownership, permission or non-infringement. No registry/common-law clearance report or
qualified review was supplied.

**Still required:** authenticated owner authorization and an appropriate jurisdictional clearance
decision by a qualified human. This AI review does not provide trademark clearance.

#### L4 — RESOLVED AT THE REPOSITORY LAYER

`CONTRIBUTING.md` now states inbound-equals-outbound MIT terms, `DCO.md` adopts DCO 1.1, and the PR
workflow checks every commit for a syntactically valid `Signed-off-by` trailer. This resolves the
documented contribution-license gap. Before accepting public contributions, configure branch
protection so the DCO and CI checks are required and cannot be casually bypassed; that repository
setting was not evidenced in this private staging review.

#### L5 — PARTIALLY REMEDIATED; ONE FALSE DELETION CLAIM REMAINS

`PRIVACY.md`, README and UI now accurately disclose local plaintext storage, outbound website
retrieval, remote-provider payloads/retention, lack of Promarkia telemetry, and the local
Ollama/offline-mock distinction. The previous remote-provider disclosure gap is resolved.

`PRIVACY.md` additionally says an individual campaign can be deleted “through the application.” No
DELETE endpoint, campaign-delete database operation or delete UI exists in the reviewed code. The
only supported deletion path is removing the applicable local data directory/files.

**Still required:** remove that claim or implement and test the described deletion feature, and make
the Docker named-volume location/deletion procedure explicit.

#### L6 — NOT RESOLVED; REPLACEMENT CLAIM IS ALSO UNSUPPORTED

The false “approval gate before generation” sentence was removed. Its replacement says the product
“requires human approval before users adopt or distribute the work.” The application cannot enforce
external adoption/distribution, and artifacts are readable before the user records approval. The
launch deck also says “approval gates” and “review every step,” while the implemented control is an
explicit post-generation approval status and there is no publishing action.

**Still required:** describe the control exactly—for example, that the application records an
explicit post-generation approval state and never publishes automatically. Do not claim it gates or
requires approval before export, adoption or distribution unless that behavior is implemented and
tested.

### Exact remaining launch blockers

1. Authenticated owner approval and supportable Agentix Labs ownership/MIT-authority chain for the
   final commit; licensed counsel confirmation if a legal opinion is required.
2. Human trademark authorization and appropriate clearance; the policy alone is not clearance.
3. Complete machine-readable native/bundled dependency inventory, corrected PyInstaller license
   expression, remediated Windows/macOS builds, and inspection of notices inside those final artifacts.
4. Correction or implementation of the unsupported per-campaign deletion claim.
5. Correction of every unsupported “approval gate,” “review every step,” and mandatory approval
   claim in launch material.
6. Required-branch-check configuration for DCO/CI before accepting public pull requests.

### Recheck decision

**CONDITIONAL PASS.** The clean-room basis, dependency-license compatibility, asset provenance,
contribution terms and core privacy disclosures are credible. They are not a complete legal or final
binary-release sign-off. Keep the repository private and do not create the public release until the
six remaining items above are evidenced and a final artifact-level recheck passes. This AI diligence
record must not be described as external-counsel approval.

---

## Focused technical remediation recheck — 2026-08-17 16:06 EDT

**State reviewed:** the complete working tree after the second L2/L5/L6 remediation pass  
**Focused verdict:** **CONDITIONAL PASS — L6 CLOSED; L2/L5 NARROWED; KEEP PRIVATE**

This section supersedes the 16:01 EDT L2, L5, L6 and remaining-blocker list where they conflict. L1,
L3, the legal-advice limitation, and the requirement not to fabricate owner/counsel evidence remain
unchanged.

### L2 — SOURCE/WORKFLOW DESIGN SUBSTANTIALLY RESOLVED; FINAL ARTIFACT GATE OPEN

Independent inspection confirms:

- PyInstaller now uses its own copied license expression,
  `GPL-2.0-or-later WITH Bootloader-exception`.
- The current Windows inventory and SBOM each contain 35 components with license and purl fields,
  including CPython, OpenSSL, PyInstaller, altgraph, pefile, hooks, pywin32-ctypes and setuptools.
- `requirements-build.lock` pins PyInstaller's transitive build dependencies and uses platform
  markers for Windows/macOS-only packages.
- The metadata generator rejects non-exact requirements, missing reviewed mappings, missing installed
  locked packages and missing license files. It detects the running CPython/OpenSSL versions.
- Release CI regenerates metadata on each target platform, builds the native package, silently
  installs the Windows installer or mounts the macOS DMG, and runs a metadata-presence check against
  that exact packaged artifact.
- The local bundle's declared 30-component inventory has no missing referenced license file, and its
  SBOM has license and purl data for all 30 components.

Two release-evidence issues remain. The local bundle is older than the current 35-component metadata
state, so its passing six-filename audit is not a test of the latest complete package. Also,
`verify_release_bundle.py` checks six required basenames but does not parse the packaged inventory and
verify that every declared `licenseFiles` path exists or reconcile its component set with the packaged
SBOM. A stale/incomplete notice directory can therefore pass that script, as the current 30-versus-35
local evidence demonstrates.

**Disposition:** the notice-generation and release design is acceptable, but L2 remains an artifact
gate. Before the public tag, strengthen the verifier to validate every inventory license path and
inventory/SBOM component agreement (or perform and preserve an equivalent manual audit), then run
the private Windows/macOS workflow and retain both successful exact-artifact audit results.

### L5 — CORE DISCLOSURE RESOLVED; ONE DESKTOP PATH ERROR REMAINS

The unsupported per-campaign deletion claim is gone. `PRIVACY.md` now correctly says there is no
per-campaign delete operation and accurately documents source and Docker named-volume deletion.

It says both source and desktop installs default to `./data`. The reviewed desktop launcher instead
sets these platform-specific defaults:

- Windows: `%LOCALAPPDATA%/PromarkiaCommunity/data`
- macOS: `~/Library/Application Support/PromarkiaCommunity/data`
- Linux desktop: `$XDG_DATA_HOME/PromarkiaCommunity/data`, falling back to
  `~/.local/share/PromarkiaCommunity/data`

**Disposition:** L5 remains open only for correcting and documenting those actual desktop paths.

### L6 — RESOLVED

The UI and package metadata now use `review-first`. The launch copy accurately describes an explicit
post-generation approval state, artifact inspection and no automatic publishing. The unsupported
approval-gate, review-every-step and mandatory pre-adoption/distribution claims were removed. The
remaining contributor instruction about adding a gate if future public-publishing behavior is added
is prospective engineering guidance, not a claim about current behavior.

### Current exact launch blockers

1. **L1:** authenticated owner approval and supportable Agentix Labs ownership/MIT-authority chain
   for the final commit; qualified licensed-counsel confirmation if the requested gate is a legal
   opinion rather than engineering provenance.
2. **L3:** authenticated trademark authorization and an appropriate human clearance decision; no
   external trademark/legal opinion is currently evidenced.
3. **L2 final artifacts:** complete the stronger inventory-to-files/SBOM audit on the exact private
   Windows installer and macOS DMG and preserve both passing CI results before tagging.
4. **L5:** correct the desktop data/deletion paths in `PRIVACY.md`.
5. Configure DCO and security/test jobs as required branch checks before accepting public pull
   requests.

**Overall verdict remains CONDITIONAL PASS.** The focused technical work closes L6 and leaves only a
small documentation correction plus final native-artifact evidence on the engineering side. It does
not resolve L1/L3 or convert this AI review into licensed legal counsel's sign-off.

---

## Final source-remediation recheck — 2026-08-17 16:18 EDT

**State reviewed:** latest complete working tree and rebuilt local PyInstaller bundle  
**Technical source verdict:** **PASS for L2, L5 and L6 source remediation**  
**Overall release verdict:** **CONDITIONAL PASS — EXTERNAL AND NATIVE-CI EVIDENCE PENDING**

This section supersedes the 16:06 EDT L2/L5 disposition. It does not supersede or waive L1, L3,
the branch-protection requirement, or the limitation that this is independent AI engineering
diligence rather than licensed legal advice.

### L2 — SOURCE REMEDIATION RESOLVED; NATIVE CI EVIDENCE PENDING

`verify_release_bundle.py` now:

- requires exactly one bundled inventory and SBOM;
- compares the exact canonical component-name/version keys in the package against the generated
  release inventory, rejecting stale, missing or extra components;
- reconciles every inventory component and license expression with the packaged SBOM;
- resolves every declared `licenseFiles` path, rejects traversal outside the bundle, and requires
  the file to exist; and
- retains the required project, notice, CPython and OpenSSL metadata checks.

Independent execution against the newly rebuilt local bundle passed with **35 components**. The
generated root inventory and bundled inventory both contain 35 components, only one bundled
`inventory.json` was present, and the previous stale 30-component bundle would now fail the exact
component comparison. The generator, build lock, license expression, SBOM enrichment and native
release-workflow checks reviewed in the prior section remain satisfactory.

**Disposition:** all identified L2 source-fixable findings are resolved. The remaining release gate
is evidence, not another source remediation: after the private commit is pushed, preserve successful
release-CI results for the exact Windows installer and macOS DMG produced on their Python 3.12 native
runners. The local bundle is strong preflight evidence but is not a substitute for those two final
artifacts.

### L5 — RESOLVED

`PRIVACY.md` now matches `app/desktop.py` and the deployment configuration. It states that there is
no per-campaign deletion operation and documents deletion for:

- source: configured directory, default `./data`;
- Windows desktop: `%LOCALAPPDATA%/PromarkiaCommunity/data`;
- macOS desktop: `~/Library/Application Support/PromarkiaCommunity/data`;
- Linux desktop: `$XDG_DATA_HOME/PromarkiaCommunity/data`, falling back to
  `~/.local/share/PromarkiaCommunity/data`; and
- Docker Compose: the `promarkia-data` named volume via `docker compose down --volumes`.

The previously reviewed outbound website/provider, plaintext-storage, telemetry and no-autopublish
disclosures remain accurate. All identified L5 source-fixable findings are resolved.

### L6 — REMAINS RESOLVED

The final language sweep still describes the implemented behavior precisely: review-first,
post-generation approval state, artifact inspection and no automatic publishing. No unsupported
mandatory-approval or pre-generation gate claim was reintroduced.

### Exact evidence still required before public release

1. **L1 ownership/licensing authority:** Dominic's authenticated approval of the final rights
   attestation and final commit, plus retained support for Agentix Labs' ownership/MIT authority.
   Obtain qualified licensed-counsel confirmation if the required sign-off is meant to be a legal
   opinion.
2. **L3 trademark:** authenticated authorization and an appropriate human trademark-clearance
   decision. No independent counsel or registry/common-law clearance opinion is currently evidenced.
3. **Native artifact CI:** one passing private release workflow whose exact Windows installer and
   macOS DMG each pass the strengthened in-package 35-or-platform-appropriate-component audit; retain
   the run URL, artifact hashes, inventories and SBOMs.
4. **Repository governance:** configure DCO, tests, security scan and release checks as required
   branch protections before accepting public contributions.

### Final current disposition

**All identified source-fixable legal/provenance findings are resolved.** The remaining conditions
are authenticated owner/trademark evidence, any licensed-counsel assurance the launch policy
requires, final native CI artifact evidence, and repository-setting enforcement. Therefore the
overall verdict remains **CONDITIONAL PASS**, not unconditional legal sign-off, and the repository
should remain private until those conditions are satisfied.

---

## Final evidence-only recheck — 2026-08-17 16:54 EDT

**Evidence reviewed:** GitHub Actions run `32054479345`, its jobs and artifact API records; current
Git/GitHub state; GitHub branch-protection API result  
**Source/provenance engineering verdict:** **PASS**  
**Overall legal/publication verdict:** **CONDITIONAL PASS — HUMAN AND FINAL-CI EVIDENCE PENDING**

### Native GitHub evidence: valid but predates remediation

GitHub's API independently confirms that the `Desktop release` workflow-dispatch run completed
successfully on both native platforms:

- Run: `https://github.com/dominiclachance/promarkia-community/actions/runs/32054479345`
- Head commit: `df9ab107e774bcc356791c15216aaa7e2c41ea66`
- Windows job: success; artifact `windows-installer`, 16,301,536 bytes, not expired,
  artifact digest `sha256:8f029e4727ceaf18f333d568fa3a80dce5e60cba9ac84b1463bd419666fef885`
- macOS job: success; artifact `macos-dmg`, 19,189,012 bytes, not expired,
  artifact digest `sha256:2620bc34b09064f1e58720626cb9fd90aec21149df457dc7ff4ed526099fe773`
- Artifact expiry recorded by GitHub: 2026-11-15.

This is credible evidence that the original installers built and smoke-tested on native runners.
It is **not** evidence that the final remediated packages contain and pass the strengthened 35- or
platform-appropriate-component license/SBOM audit. The run's head is the older `df9ab107` commit;
the current source-remediation work is still uncommitted on top of `503be489`, and the historical
job step list has no Windows installed-package audit or macOS mounted-DMG audit. Therefore the old
artifacts do not close the final native-artifact condition and must not be published as the audited
release candidate.

### Branch protection evidence and required publication transaction

The GitHub branch-protection API returned HTTP 403 with: “Upgrade to GitHub Pro or make this
repository public to enable this feature.” Branch protection therefore cannot be pre-staged while
this repository remains private on its current plan. This is a verified plan limitation, not an
unresolved source-code defect.

Because GitHub does not offer an atomic visibility-and-protection API operation, publication must be
handled as a tightly controlled transaction:

1. Freeze merges, tags, releases and launch communications; prepare and validate the exact branch-
   protection/ruleset API request in advance.
2. Change visibility to public.
3. Immediately apply protection to `main`: require pull requests and the DCO, test and security
   checks; block force pushes and deletion; require conversation resolution; include administrators
   unless a documented emergency procedure says otherwise.
4. Read the protection/ruleset back through GitHub's API and verify every required control.
5. Only after verification, create the signed release tag and begin launch communications. If the
   control cannot be applied, stop the launch immediately and restore private visibility where the
   plan permits; do not accept contributions or publish a release in the unprotected state.

The short interval between steps 2 and 3 is an unavoidable platform limitation. Keep it unattended
by launch traffic and as short as operationally possible. Record the visibility time, protection
response, verification response and operator.

### Non-delegable human/legal gates

The engineering provenance evidence supports the source's clean-room basis and all identified
source-fixable L2/L4/L5/L6 remediation. It cannot establish the following by delegation to an AI or
by an implementer's self-authored policy:

1. **Owner rights attestation (L1):** Dominic Lachance must personally authenticate approval of the
   final commit and rights attestation and retain the supporting ownership/assignment/tool records.
2. **Trademark authorization and clearance (L3):** the responsible human must authorize the final
   marks and obtain the level of registry/common-law/jurisdictional clearance appropriate to the
   launch risk.
3. **Licensed-counsel opinion:** if “legal sign-off” means a lawyer's opinion, only retained,
   qualified counsel can provide it. This report is not that opinion and must not be represented as
   one.

### Exact evidence still outstanding

1. A final committed and authenticated L1 rights attestation tied to the release commit.
2. The documented L3 human trademark decision and any required external clearance/counsel record.
3. A **new** private `Desktop release` run on the final remediation commit, with both native jobs and
   strengthened installed-Windows/mounted-macOS metadata audits passing; retain the run URL, artifact
   API digests, checksums, packaged inventories and SBOMs.
4. Successful completion and API verification of the immediate post-publication branch-protection
   transaction before tagging, accepting contributions or announcing the launch.

### Final evidence disposition

**All identified fixable source/provenance engineering findings are resolved.** Historical run
`32054479345` adds native-build evidence but does not replace the required final remediation run.
Owner rights, trademark clearance and any licensed-counsel opinion remain human/external gates.
Accordingly the repository remains at **CONDITIONAL PASS** and should stay private until items 1–3
are evidenced; publication may then proceed only through the controlled visibility/protection
transaction in item 4.

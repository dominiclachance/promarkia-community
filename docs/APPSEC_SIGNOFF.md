# Independent AI Application-Security Review

**Review date:** 2026-08-17  
**Reviewer:** Independent Codex AI review session (separate from the implementation session)  
**Overall verdict:** **PASS WITH CONDITIONS — source-level application-security signoff is granted; no known Critical or High source finding remains open**  
**Community repository alone:** **CONDITIONAL PASS**; network exposure and secret-scan configuration are remediated, but hosted CI proof and release hardening remain operational conditions  
**Hosted production application:** **PASS WITH CONDITIONS**; deploy exact reviewed revisions and complete the live verification gates below

This is an independent AI-assisted source review, not legal advice, a professional penetration
test, or a certification by a qualified security consultancy. No destructive testing, real
payments, production data access, credential use, or external exploitation was performed.

## Scope

- Public-release candidate: `promarkia-open-source-pricing-2026-08-17/community` at commit
  `503be48`.
- Production-derived frontend and Firebase Functions source:
  `worktrees/production-followup-20260817T171503Z/promarkia_2026`.
- Trusted bridge: `worktrees/backend-hardcap-20260817T185528Z/auth_server/server.py`.
- The worker WebSocket auth path was inspected only where needed to validate bridge-issued tokens.
- Focus: secrets and public-repository leakage, authentication and authorization, SSRF and path
  traversal, command/code injection, Stripe webhook integrity and idempotency, billing
  enforcement, unsafe defaults, dependencies, and CI/release supply chain.

Deployment/IAM configuration, Stripe dashboard, Firebase Auth tenant configuration, Cloudflare
configuration, and live databases were not in source scope. This review therefore cannot certify
deployed configuration parity, tool sandboxing, or network egress policy.

## Sixth independent remediation recheck - 2026-08-17

**Verdict: PASS WITH CONDITIONS. Source-level application-security signoff is granted.**

The sixth pass independently inspected the FIFTH remediations and reran the affected security
suites. FIFTH-01 and FIFTH-02 are resolved in the reviewed source. No unresolved Critical or High
application-security finding was identified in this recheck.

Verified corrections:

- On POSIX systems, `_open_safe_run_file` opens the trusted artifact base directory, the run
  directory, every intermediate directory, and the final file using descriptor-relative
  `openat` semantics. Directory components require `O_DIRECTORY | O_NOFOLLOW`; the final file
  requires `O_NOFOLLOW` and is checked with `fstat` before use. The file remains anchored to the
  already-open directory descriptor even if the pathname's ancestor is swapped concurrently.
- The Linux-only deterministic regression swaps the final file's parent directory to a symlink
  immediately before the final descriptor-relative open and proves the original safe file is
  read. The local Windows run correctly skipped this POSIX-only test; the supplied Linux
  production-host result reports all 21 bridge tests passing.
- Signed MCP authorization requests now carry a random 24-byte URL-safe `jti`. The callback
  transaction creates a hashed one-time request marker, checks global/user/IP counters, increments
  those counters, and creates the authorization code atomically. Transaction conflicts therefore
  prevent replay or parallel reuse of the same signed request.
- Authorization-code creation is capped at 100/hour globally, 20/hour per verified user, and
  30/hour per request fingerprint. Dynamic client registration is capped at 50/hour globally and
  10/hour per client fingerprint.
- The daily cleanup now deletes up to 5,000 expired documents **per collection** from
  `mcpOAuthClients`, `mcpOAuthRateLimits`, `mcpOAuthCodeRateLimits`, `mcpOAuthRequests`, and
  `mcpOAuthCodes`. Maximum distinct daily ingress is bounded below that per-collection capacity:
  1,200 clients, 1,224 registration-rate documents, 2,400 request markers, 2,400 codes, and 4,824
  code-rate documents.

### Sixth recheck verification

| Check | Independent result |
|---|---|
| Bridge security-boundary suite on Windows | 20 passed, 1 expected Linux-only skip |
| Bridge `artifact_service.py` and `server.py` `py_compile` | passed |
| Production Functions suite | 13 passed |
| Linux ancestor-swap regression | supplied production-host run: 21 passed |
| Manual descriptor walk and OAuth transaction review | FIFTH-01 and FIFTH-02 resolved |
| Manual ingress-versus-cleanup calculation | every collection remains below 5,000/day |

Conditions on this signoff:

1. Deploy the exact reviewed bridge, hardened MCP, worker, Firebase Functions, and rules revisions;
   verify production hashes/configuration and retain the green Linux regression result.
2. Complete the already-running 24–48 hour Stripe webhook observation window before public launch,
   with no unexplained signature failures, retry loops, duplicate grants, or missing events.
3. Make hosted CI required and obtain a green full-history secret scan, test suite, dependency
   audit, and release-bundle verification for the exact public commit/tag.
4. Alert when any OAuth cleanup collection approaches or reaches its 5,000-document run cap.
   Firestore native TTL on `expiresAt` remains strongly recommended as defense in depth: the
   worst-case code-rate collection has only 176 documents/day of cleanup headroom, so a missed
   cleanup run can take many days to drain under sustained maximum traffic.
5. Treat installers as unsigned/unnotarized until signing is implemented, publish checksums, and
   do not present this AI source review as a professional penetration-test certification.

The operational conditions above do not reopen a source-level Critical or High finding. A
material code/configuration change, failed deployment-parity check, or cleanup/authorization-code
anomaly requires a new review before relying on this signoff.

## Fifth independent remediation recheck - 2026-08-17

**Verdict: FAIL. No application-security signoff is granted.**

The fifth pass independently inspected and exercised the FOURTH remediations. FOURTH-01 and
FOURTH-03 are resolved in the reviewed source. FOURTH-02 and FOURTH-04 are substantially improved
but retain one launch blocker each.

Verified corrections:

- Run start is consumed with one SQL `UPDATE ... WHERE status = CREATED` transaction before task
  creation. A real two-thread SQLite database test returns exactly one successful claim.
- Artifact promotion now requires the durable Firestore browser/external run owner, derives the
  team ID from that record, requires explicit URLs to occur in that run's stored data/messages,
  and accepts files only from `<AUTOGEN_FILES_BASE>/<run_id>`. Shared time-window/recent scans are
  disabled. Cross-user, crafted URL, outside path, and ordinary symlink tests pass.
- Supported top-level connection-ID fields are protected by Firestore rules and client writes to
  `users/{userId}/integrations` are denied. The bridge records server-only hashed binding document
  IDs during verified OAuth/direct connection and validates unbound legacy IDs against Composio
  ownership before status, disconnect, or execution context use. The forged-ID test and Firestore
  emulator denial pass.
- MCP redirects now require explicit-port HTTP loopback or the HTTPS Claude allowlist. DCR uses a
  deterministic registration ID and transactional hourly per-client/global counters with expiry.
  Authorization-code read/delete is transactional, and the cleanup Function is source-backed.

### FIFTH-01 - HIGH - Artifact open remains vulnerable to ancestor-symlink TOCTOU

`_validated_run_file` checks path components and resolves the candidate, but
`_open_safe_run_file` later opens the resolved pathname with `O_NOFOLLOW`. On Linux,
`O_NOFOLLOW` protects only the final path component. A tool or background process that can mutate
the run output directory can replace an intermediate directory with a symlink between validation
and open, redirecting the upload outside the run root.

Open the authoritative run root once as a directory file descriptor and traverse every component
with `openat` plus `O_NOFOLLOW`/`O_DIRECTORY`, then open the final regular file relative to that
descriptor; alternatively use Linux `openat2` with `RESOLVE_BENEATH | RESOLVE_NO_SYMLINKS`.
Add an adversarial component-swap/race test, not only a static final-symlink test.

### FIFTH-02 - HIGH - OAuth persistence ingress still exceeds bounded cleanup

DCR permits 200 unique registrations per hour globally, or 4,800 client documents per day.
`deleteExpiredDocuments` hard-stops after 2,000 deletions per collection per daily cleanup run.
Once the 90-day client horizon is reached, a sustained attacker can expire 4,800 client documents
per day while cleanup removes at most 2,000; backlog and storage therefore grow indefinitely.

Separately, authenticated `/oauth/callback` permits repeated or concurrent reuse of the same
ten-minute signed authorization request and creates a new five-minute `mcpOAuthCodes` document
each time. There is no per-user/global issuance cap or one-time authorization-request consumption,
so one account can generate unbounded writes and unredeemed code documents. Transactional token
redemption does not address issuance spam.

Enable Firestore native TTL on `expiresAt` and make cleanup throughput provably exceed maximum
ingress with monitoring. Consume an authorization-request `jti` once or add transactional
per-user/global code-issuance limits. Add tests tying maximum daily ingress to deletion capacity
and proving replay/parallel callback issuance is bounded.

### Fifth recheck verification

| Check | Independent result |
|---|---|
| Bridge security-boundary suite | 19 passed |
| Worker run/config/start suite | 4 passed, including real two-thread database CAS |
| Hardened MCP assertion suite | 2 passed |
| Production Functions suite | 12 passed |
| Firestore emulator with Java 21 | 3 passed |
| Bridge, artifact, worker, and MCP `py_compile` | passed |
| Manual TOCTOU and lifecycle-capacity review | blockers FIFTH-01 and FIFTH-02 |

General-availability release and hosted promotion remain blocked pending correction and a fresh
independent recheck. This AI source review remains distinct from a professional penetration test.

## Fourth independent remediation recheck - 2026-08-17

**Verdict: FAIL. No application-security signoff is granted.**

This recheck independently traced the three THIRD remediations rather than relying on the
implementation summary. All three are materially corrected in the reviewed local source:

- Worker service JWTs now require a canonical SHA-256 `team_config_hash`; the bridge derives it
  from the server-fetched team configuration and the worker compares it before starting. The
  cheap-versus-custom negative test passes.
- The hardened MCP source creates a 60-second HS256 `promarkia-mcp` to `promarkia-bridge`
  assertion from the already validated caller identity. The bridge requires both the configured
  MCP service API key and the signed assertion, rejects unsigned `X-MCP-User-ID`, and returns the
  assertion subject as the billable user. Two-user insufficient-credit coverage passes.
- `/oauth/authorize` now embeds only a signed, ten-minute authorization-request token through a
  script-safe JSON serializer. `/oauth/callback` verifies it and ignores replacement redirect and
  scope fields in the POST body. The script-terminator regression passes.

The hardened MCP implementation is in
`worktrees/mcp-hardening-20260817T2030Z/home/ubuntu/promarkia_mcp`; the older copy under the bridge
worktree still sends unsigned `X-MCP-User-ID`. Deployment must use the hardened copy and verify
the live file hash/configuration.

The deeper end-to-end pass found the following additional launch blockers.

### FOURTH-01 - CRITICAL - One billed run can start provider execution repeatedly

`autogenstudio/web/routes/ws.py` accepts every valid `type=start` frame and launches a new
`asyncio.create_task(ws_manager.start_stream(...))`. `WebSocketManager.start_stream` has no
atomic once-only guard; it overwrites `_cancellation_tokens[run_id]` and writes ACTIVE after the
task has started. A caller can send multiple start frames, or open multiple WebSockets with the
same two-minute run token, and create concurrent provider executions behind one reservation.

Implement a durable atomic CREATED-to-ACTIVE compare-and-set before spawning. Reject every later
start across connections, processes, and worker replicas. Add a concurrent test proving two start
attempts cause exactly one `TeamManager.run_stream` invocation.

### FOURTH-02 - CRITICAL - Artifact promotion permits cross-tenant and host-file disclosure

`POST /api/runs/<run_id>/artifacts/promote` authenticates the caller but never authorizes ownership
of `run_id`. The artifact service then scans the shared `AUTOGEN_FILES_BASE/<run_id>` directory or
accepts any `/api/files/user/...` path under the shared base. An attacker who supplies another
numeric run ID can copy that run's files into the attacker's Firebase area. Explicit file paths
are likewise not bound to a run/user. Candidate checks use `Path.is_file()` and upload by path,
which follows symlinks; a tool-created symlink can expose host files.

Require the durable browser/external run owner before promotion. Maintain a server-side output
manifest for the exact run/user, reject arbitrary shared-base paths, reject symlinks, and enforce
resolved per-run containment with safe file opening. Add two-user victim-run, crafted file URL,
symlink, and traversal tests.

### FOURTH-03 - HIGH - Client-writable connection IDs undermine integration ownership

Composio disconnect/status authorization and external-run integration context trust the user's
top-level `*ConnectionId` fields. Firestore `protectedUserFields()` does not protect those fields,
the generic user update rule allows their mutation, and the frontend writes them directly. A
caller can place an arbitrary connected-account ID in their own document, causing the bridge to
treat it as owned and inject it into execution context.

Move connection bindings to a server-managed collection or protect all connection-binding fields
and update them only after verified OAuth completion. Validate the connected account's actual
Composio user/entity before every sensitive use. Add a test proving a forged client-side binding
cannot authorize status, disconnect, or task execution.

### FOURTH-04 - HIGH - MCP OAuth still exposes unsafe redirect and persistence primitives

Both dynamic registration and the unregistered authorize fallback accept any URI scheme when the
hostname is loopback. Values such as `javascript://localhost/...` or custom protocols pass and
are later assigned to `window.location.href`. Require `http` for loopback redirects and `https`
for the explicit Claude domain allowlist; reject JavaScript, data, file, and custom schemes.

In addition, unauthenticated `/oauth/register` creates a random persistent Firestore document on
every request with no application-level rate limit, deduplication, quota, or expiry, exposing an
unbounded write/storage billing primitive. Enforce edge and application rate limits, TTL cleanup,
and deterministic deduplication or authenticated software statements. The authorization-code
exchange also reads and deletes the code non-transactionally; consume it with an atomic
single-use transaction.

### Fourth recheck verification

| Check | Independent result |
|---|---|
| Bridge security-boundary suite | 12 passed |
| Worker run/config-scoped WebSocket suite | 3 passed |
| Hardened MCP assertion suite | 2 passed |
| Bridge, worker, and hardened MCP `py_compile` | passed |
| Manual end-to-end trust-boundary review | blockers FOURTH-01 through FOURTH-04 |

Public release and hosted promotion remain blocked pending remediation and an independent recheck
of these four findings. A professional penetration test remains outside this AI source review.

## Third independent remediation recheck

This section is the current disposition and supersedes the earlier rechecks below.

The claimed fixes for NEW-01 through NEW-05 were traced through the bridge and worker. Verified
improvements include authenticated Composio start/disconnect/status routes, expiring one-time
Composio OAuth state, authenticated/disabled scheduled-task mutation routes, transactional
charge-before-dispatch reservations for browser and external API runs, exact-balance WebSocket
issuance, transactional session ownership, and two-minute run-scoped worker JWTs. The legacy
conversation fallback now requires the exact lowercased `email + " - "` delimiter and escapes
backslash, percent, and underscore before an explicit SQL `LIKE ... ESCAPE` query. Its new prefix
collision and wildcard tests pass.

Those fixes close the five findings from the preceding recheck, but the deeper end-to-end trace
found three launch blockers.

### THIRD-01 - CRITICAL - Browser execution is not bound to the billed team configuration

The bridge reserves credits from the Firestore session's `teamId`, but the browser subsequently
sends `team_config` directly in the worker WebSocket `start` message. The worker accepts that
object and passes it to `start_stream` (`autogenstudio/web/routes/ws.py:115-118`). A modified
client can therefore reserve the cheap/default tariff and execute a different, more expensive, or
custom agent/model/tool configuration. Run-scoped JWTs prevent cross-run access, but they do not
bind the billed team to what executes.

The worker must load the authoritative team configuration server-side, or verify a bridge-signed
team/config digest bound to the run and reservation. It must reject browser-supplied configuration
that differs. Add a negative test proving a cheap-team reservation cannot start with an expensive
or custom configuration.

### THIRD-02 - CRITICAL - MCP OAuth users are billed to the shared service API-key owner

`promarkia_mcp/server.py` validates the OAuth JWT and derives its `sub`, but `_run_squad` calls the
bridge using the shared `MCP_SERVICE_KEY` as `X-API-Key`; it sends the OAuth subject only in
`X-MCP-User-ID`. `auth_server/server.py::resolve_api_key` ignores `X-MCP-User-ID` and returns the
shared API-key document's owner. Consequently, MCP users reserve and consume the shared account's
credits instead of their own, bypass their individual wallet/hard cap, and can exhaust the shared
account.

Use an authenticated service-to-bridge assertion whose subject is copied from the already
validated MCP JWT (for example, a short-lived signed audience-bound JWT). The bridge must reject
an unsigned/spoofed user header. Add two-user tests proving user A's MCP run debits only A and is
rejected when A lacks credits even if the service account has a balance.

### THIRD-03 - HIGH - MCP authorization page has reflected script injection

`/oauth/authorize` places attacker-controlled OAuth parameters into `oauth_params_json` and
raw-replaces that JSON into a module script (`const PARAMS = __OAUTH_PARAMS_JSON__`). Python
`json.dumps` does not escape the HTML script terminator. A parameter containing `</script>` can
break out of the script on the Promarkia origin, replace the sign-in handler, and access the login
page's same-origin/Firebase context.

Use a script-safe serializer that escapes `<`, `>`, `&`, and the Unicode line separators, or put
HTML-escaped JSON in a non-executable `application/json` element. Add a response-level regression
test proving no attacker-controlled literal `</script>` appears. The callback should also bind
client, redirect URI, requested scope, and PKCE challenge to server-side authorization state
instead of accepting those fields afresh from its POST body.

### Third recheck verification

| Check | Independent result |
|---|---|
| Community `pytest` | 25 passed |
| Community non-loopback startup guard | wildcard bind exited 1 with the expected fail-closed message |
| Community Bandit | no findings |
| Community `pip-audit` | no known vulnerabilities |
| Community compileall | passed |
| Community Gitleaks workflow config | full-history checkout, SHA-pinned action, and documented `GITHUB_TOKEN` present; hosted run not yet proven |
| Bridge security-boundary suite | 9 passed |
| Worker run-scoped WebSocket suite | 2 passed |
| Bridge/worker `py_compile` | passed |

The Community direct-run guard now refuses every non-loopback bind unless
`PROMARKIA_UNSAFE_ALLOW_NETWORK_BIND=1` is explicitly set. The supported Compose path acknowledges
the internal wildcard bind while publishing only to host loopback. This closes APPSEC-06 in the
reviewed source. Supplying `GITHUB_TOKEN` closes the Gitleaks configuration defect, but the new
private workflow still needs a successful hosted run before it can be treated as an operational
control. Installer signing/notarization, hash-locked dependencies, and immutable build-tool
verification remain release-hardening conditions rather than demonstrated critical exploits.

## Fresh remediation recheck

This section supersedes the first-pass dispositions retained below as an audit trail.

| Prior finding | Recheck disposition | Evidence |
|---|---|---|
| APPSEC-01, browser telemetry billing | **Partially resolved** | `recordUsage` now rejects browser reports. Bridge run creation transactionally reserves credits before worker dispatch and requires an idempotency key. Browser paths attach a random key. Explicit HTTP rejection refunds transactionally; ambiguous dispatch stays charged for reconciliation. Programmatic/MCP execution remains post-paid and bypassable; see NEW-02. |
| APPSEC-02, scheduled-task confused deputy | **Mitigated for current production** | `scheduledTaskRunner` is a no-op and Firestore clients cannot create/update/delete tasks. Dangerous legacy scheduler code remains and must not be re-enabled without redesign. |
| APPSEC-03, scheduled-run disclosure | **Resolved** | Rules authorize through parent ownership and deny client writes. Two Firestore emulator tests passed, including cross-user denial. |
| APPSEC-04, scheduler worker auth | **Mitigated by disabling scheduler** | The exported runner no longer calls the legacy unauthenticated path. The `token=null` fallback remains dead code and must be removed before scheduling returns. A generic WebSocket-token issue remains; see NEW-03. |
| APPSEC-05, Community DNS rebinding | **Resolved in reviewed code** | Each hop resolves once, validates every address, connects to the selected literal IP, preserves Host/TLS SNI, and revalidates redirects. A deterministic rebinding regression test passed. |
| APPSEC-06, Docker/local guard | **Open, medium** | Compose publishes only loopback and is the documented path, but the image binds `0.0.0.0` and Host-header authorization is not safe if a user publishes the container port directly. |
| APPSEC-07, secret scanning | **Partially resolved; not operationally proven** | Full-history checkout and a SHA-pinned Gitleaks action were added. The workflow omits the documented required `GITHUB_TOKEN`, and the pinned v2/Node 20 action reaches end of life in September 2026. No successful run of the new job was provided. |
| APPSEC-08, release supply chain | **Partially resolved** | Container now uses the runtime lock and release write permission is limited to publication. Locks still lack hashes, NSIS is mutable latest, signed-tag enforcement is absent, and installers are not signed/notarized. |
| APPSEC-09, dependency advisories | **Risk accepted for reviewed path; monitor upstream** | Frontend runtime audit is clean. Latest Firebase Admin/Functions report seven moderate transitive advisories from `@google-cloud/storage` via `uuid@9`. The advisory affects caller-supplied buffers in UUID v3/v5/v6; inspected transitive call sites use UUID v4 only, so no reachable exploit path was found. |

### NEW-01 - CRITICAL - Multiple production backend routes lack authentication and ownership checks

The bridge review exposed older Flask routes outside the bridge that remain callable without an
authentication or ownership check:

- `server.py:248-392` starts Composio connections from client-supplied `user_id` /
  `firestore_user_id`; the callback writes connection IDs without binding the flow to a verified
  Firebase identity or validating one-time OAuth state.
- `server.py:557-581` disconnects a supplied Composio connected-account ID without owner auth.
- `server.py:592-697` lists conversations by arbitrary email, returns messages for a numeric
  session ID, and deletes a session without owner auth.
- `server.py:942-993` bills a supplied user ID and deletes or patches a supplied scheduled task
  without auth.

These paths permit cross-account data disclosure/deletion, integration tampering, task tampering,
and arbitrary credit depletion. Require verified Firebase/API/service authentication on every
route, derive canonical ownership server-side, validate expiring one-time OAuth state, authorize
every object reference, and add negative cross-user tests. Disable these paths at the reverse
proxy until corrected.

### NEW-02 - CRITICAL - Hard caps still do not cover programmatic/MCP runs

`server.py:2346-2427` checks balance with a non-transactional read, dispatches, and returns before
charging. `server.py:2232-2258` charges only after completion, while `server.py:920-939` clamps the
balance to zero. Concurrent API-key/MCP requests can all pass one balance check, consume provider
resources, and discard the shortfall. Failed runs can also escape usage-based charging.

Use the same transactional reservation/idempotency state machine for every hosted dispatch path,
including external/MCP, with charge-before-dispatch and explicit-rejection refund. Browser, MCP,
API-key, and any future scheduled execution must share the same invariant.

### NEW-03 - HIGH - Browser receives a generic service WebSocket credential

`server.py:2915-2934` obtains a service token without a run identifier and returns it to the
browser. Worker runs and the token use the same shared service identity. The worker WebSocket
authorizes by that identity, so the browser-visible token can authorize other shared-service runs
if their numeric IDs are discovered. The bridge owner check protects issuance only, not the
subsequent direct connection.

Mint a short-lived one-time token bound to `run_id` and canonical user and enforce those claims at
the worker, or proxy WebSockets through the bridge without exposing service credentials.

### NEW-04 - HIGH - A fully charged browser run can be stranded before execution

The bridge deducts the reservation during `/api/autogen/runs`, but `server.py:2915` performs a
second minimum-balance check when issuing the WebSocket URL. If the reservation leaves fewer than
2,000 credits, the user is charged and receives a worker run ID but cannot start it; no refund path
applies because worker creation succeeded.

Require authentication, run ownership, and a completed reservation at WebSocket issuance, not a
second wallet threshold. Add an exact-balance end-to-end test.

### NEW-05 - MEDIUM - Browser session ownership claim is not atomic

`server.py:1296-1305` reads then merge-writes a client-selectable six-digit session ID without a
transaction. Concurrent first claims can overwrite ownership. Generate a high-entropy session ID
server-side and transactionally create the ownership record, or fail if it exists.

### Recheck verification

| Check | Independent result |
|---|---|
| Community `pytest` | 22 passed |
| Community Bandit | no findings |
| Community `pip-audit` | no known vulnerabilities |
| Community tracked/history credential-pattern scan | no matches in limited regex scan |
| Production Functions `npm test` | 12 passed |
| Functions module load | succeeded; expected exports present |
| Firestore emulator with Java 21 | 2 passed |
| Frontend ESLint | passed with zero warnings |
| Frontend production build | passed; Chat 288.43 KB, client 369.56 KB |
| Frontend runtime `npm audit --omit=dev` | 0 vulnerabilities |
| Functions runtime `npm audit --omit=dev` | 7 moderate, 0 high, 0 critical; no reviewed reachable UUID advisory path |
| Local build-mount smoke | passed; React mounted and static fallback was absent |

The browser reservation code has no automated unit/concurrency suite in the reviewed backend
worktree. Its transaction/refund properties were established by source inspection, not live
Firestore failure injection.

## Initial findings from first pass (superseded by the recheck above)

### APPSEC-01 — CRITICAL — Hosted usage and hard caps are client-bypassable

**Evidence:**

- `functions/billing/recordUsage.js:7-8` accepts token and media counts supplied by the browser;
  zero is valid.
- `functions/billing/recordUsage.js:28-45` authenticates the caller but does not prove that the run
  belongs to that caller, retrieve authoritative worker telemetry, or verify that the run
  completed.
- Its idempotency key is only `uid + runId`, and the event is created once. A caller can submit a
  zero-usage event first and cause the legitimate later report for that run to be deduplicated.
- `src/stores/ChatStore.js:1338-1339` reports usage from the browser after the result. A modified
  client can omit or falsify that call.

**Impact:** An authenticated user with any positive balance can run hosted workloads without a
reliable server-side charge. The advertised hard cap is therefore not a hard cap, and expensive
image/video or agent runs can create unbounded provider cost.

**Required remediation:** Meter and finalize usage from the trusted bridge/worker, not the browser.
Atomically reserve a conservative maximum/minimum before issuing a run, bind the run to its owner,
finalize from server-observed telemetry, and refund unused reservation. Reject zero-value client
events and prevent client-created events from occupying the authoritative idempotency key.

### APPSEC-02 — CRITICAL — Scheduled tasks are a privileged confused deputy

**Evidence:**

- `firestore.rules:96-101` lets any authenticated user create a scheduled task when only `userId`
  equals their Auth UID. It does not constrain `entityId`, `userEmail`, `connectedAccountIds`,
  `squadId`, prompt, or other execution fields. Updates can also rewrite those fields.
- `functions/scheduler/index.js:93-100` trusts client-supplied `entityId` and
  `connectedAccountIds` without an ownership lookup when both are present.
- `functions/scheduler/index.js:474`, `:483`, and `:516-518` execute the task as the global
  `dlachance@agentixlabs.com` backend identity, may select billing by attacker-controlled
  `entityId`, inject connected-account identifiers into the prompt, and auto-approve external
  actions.

**Impact:** A normal authenticated account can potentially cause privileged squad execution,
target another entity or integration, and consume another account's credits. Because scheduled
prompts explicitly auto-approve actions, the blast radius can include external publishing.

**Required remediation:** Disable scheduled execution until tasks are created through an
authenticated server callable. Derive owner, canonical billing UID, entity, and integration IDs
server-side; make them immutable; verify every referenced connection belongs to that owner; and
execute with a per-user service identity rather than a shared founder identity. Add Firestore
emulator authorization tests for malicious create/update payloads.

### APPSEC-03 — HIGH — Authenticated users can read every scheduled-run result

**Evidence:** `firestore.rules:104-106` grants `read` on every
`scheduledTasks/{taskId}/runs/{runId}` document to any authenticated user. The scheduler writes
`task_result`, messages, `entity_id`, and run identifiers to those documents.

**Impact:** Cross-tenant disclosure of campaign content, prompts, generated output, integration
context, and potentially personal or confidential business data.

**Required remediation:** Authorize through the parent task owner/canonical UID, or copy a
server-derived owner field into every run and enforce equality. Add negative multi-user emulator
tests.

### APPSEC-04 — HIGH — Scheduled worker authentication is internally inconsistent

**Evidence:** `functions/scheduler/index.js:147-210` calls worker endpoints without Firebase or
service authentication. `:224-233` falls back to a WebSocket URL containing `token=null` when
bridge authorization fails.

**Impact:** With the documented worker hardening enabled, scheduled work should fail with 401. If
these calls still succeed, the worker boundary remains bypassable. Either state is unacceptable
for release.

**Required remediation:** Remove the `token=null` fallback, route every scheduler call through the
authenticated bridge, use a narrowly scoped workload identity or short-lived signed token, and
add an end-to-end scheduled-run test that proves both unauthorized denial and authorized success.

### APPSEC-05 — HIGH — Community URL fetch remains vulnerable to DNS rebinding

**Evidence:** `app/services/safe_fetch.py:30-55` resolves and validates the hostname, but
`app/services/safe_fetch.py:89-100` later gives the hostname to `httpx`, which performs a separate
resolution for the connection. Redirects repeat the same check/connect gap.

**Impact:** A malicious domain can return a public address during validation and a loopback,
private, link-local, or metadata address during connection, bypassing the SSRF policy. Retrieved
internal text may then be sent to a configured model provider and incorporated into artifacts.

**Required remediation:** Pin the validated IP at connection time while preserving the original
Host header and TLS SNI, or use a transport that validates the actual connected peer address.
Revalidate every redirect and add deterministic DNS-rebinding tests.

## Additional findings

### APPSEC-06 — MEDIUM — The local-only guard becomes bypassable if the container is exposed

The Docker image binds the process to `0.0.0.0` (`Dockerfile:11`). Compose safely publishes it to
loopback, but the application authorizes based on the request Host value
(`app/api.py:19-25`, `:48`). A remote client can supply `Host: localhost` when a user publishes the
container port directly. There is no user authentication because the intended deployment is
single-user loopback.

Keep the container publication loopback-only at the runtime/network layer. Refuse startup when
configured non-loopback unless an explicit authenticated-network mode exists; do not treat Host as
a network-origin control.

### APPSEC-07 — MEDIUM — CI claims a secret scan that it does not run

`docs/SECURITY_REVIEW.md:45` requires a secret scan on every pull request, but
`.github/workflows/ci.yml` runs tests, Bandit, `pip-audit`, compile, and SBOM only. A manual regex
scan of current tracked files and all three commits found no AWS, Google service, Stripe live,
OpenAI-like, GitHub, Slack, or private-key credential patterns. That limited result does not
replace a history-aware secret scanner.

Add a pinned, history-aware secret-scanning action with an reviewed allowlist and make it a
required branch-protection check before public contributions are accepted.

### APPSEC-08 — MEDIUM — Release dependency/install chain is not fully reproducible

GitHub Actions are pinned by commit SHA, which is good. However, Python lock files pin versions
without hashes, the Dockerfile installs from broad `pyproject.toml` ranges instead of the runtime
lock, and release CI installs mutable Chocolatey `nsis` without a version
(`.github/workflows/release.yml:35`, `:53`). The workflow also grants `contents: write` to every
release job, not only publication. Windows and macOS artifacts are not yet signed/notarized.

Use hash-locked dependencies, build the container from the same lock, pin and verify NSIS, reduce
build-job token permissions, enforce signed tags, produce provenance/attestations, and sign and
notarize public installers.

### APPSEC-09 — MEDIUM — Known moderate production dependency advisories remain

Fresh `npm audit --omit=dev` checks reported 3 moderate runtime findings in the frontend dependency
tree (`react-router`, `react-router-dom`, `uuid`) and 9 moderate findings in the Functions tree
(`@google-cloud/firestore`, `@google-cloud/storage`, `firebase-admin`, `firebase-functions`,
`gaxios`, `google-gax`, `retry-request`, `teeny-request`, `uuid`). No high or critical runtime
advisories were reported. Upgrade or document reachability-based acceptance before launch.

## Controls that passed review

- Community: 21 tests passed; Bandit returned no findings; `pip-audit` reported no known
  vulnerabilities in `requirements.lock`.
- Community tracked files and Git history contained no credential-pattern match in the limited
  independent scan. No customer database, `.env`, private key, production Firebase/Stripe control
  plane, or production source file is tracked.
- Community artifact names are fixed and campaign paths are validated
  (`app/services/artifacts.py:9-63`); no shell, `eval`, plugin execution, or unsafe deserialization
  sink was found.
- Community desktop binds loopback; Docker Compose publishes only `127.0.0.1:8788` and runs as a
  non-root user.
- Stripe webhook verification uses the raw request body and configured signing secret
  (`functions/index.js:200-219`). Event leases and transactional grant records provide reasonable
  retry/idempotency protection (`:224-275`, `:396-430`).
- Checkout and portal callables require Firebase authentication. Checkout uses a server allowlist
  of active Stripe prices and return URLs are origin-allowlisted.
- Auto-recharge is opt-in, monthly bounded, uses a Stripe idempotency key, and only accepts known
  one-time prices.
- Firestore denies direct client writes to billing events and protects credit, identity, plan, and
  billing-policy fields on user documents.
- Production Functions: all 12 billing/catalog tests passed.

## Verification performed

| Check | Result |
|---|---|
| Community `pytest` | 21 passed |
| Community Bandit | no findings |
| Community `pip-audit` | no known vulnerabilities |
| Community tracked/history credential-pattern scan | no matches; limited regex scan |
| Production Functions `npm test` | 12 passed |
| Frontend runtime `npm audit --omit=dev` | 3 moderate, 0 high, 0 critical |
| Functions runtime `npm audit --omit=dev` | 9 moderate, 0 high, 0 critical |
| Manual auth/authz, billing, webhook, SSRF, path, sink, and CI review | blockers above |

## Sign-off decision

**Application-security source signoff is granted with the conditions listed in the sixth recheck.**
FIFTH-01 and FIFTH-02 are resolved: artifact reads use component-wise descriptor anchoring on
Linux, and MCP OAuth request/code persistence is transactionally one-time, rate-bounded, and
covered by per-collection cleanup capacity above maximum daily ingress.

This signoff covers the reviewed source snapshot, not unverified production configuration or a
professional penetration test. Public release remains contingent on exact deployment parity,
green required hosted CI for the release commit/tag, completion of the Stripe webhook observation
window, cleanup-cap monitoring, and honest disclosure of unsigned/unnotarized installers.

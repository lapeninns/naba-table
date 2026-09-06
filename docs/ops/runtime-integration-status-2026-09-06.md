# Runtime integration status — 2026-09-06

This is a staging verification and release handoff, not production promotion approval. Work ran in the isolated `/tmp/nabatable-backend-release-c3dc07c` checkout on `codex/remaining-runtime-integrations`. The original checkout and its dependency installation were left alone.

## Release identity

The web application and all four staging Workers were deployed and independently verified at `656373a640030f0b846b2e92acefc920e0fa1e71`. Subsequent commits contain only proof-test/documentation updates; they are not represented as newly deployed runtime revisions.

| Staging component   | Verified provider deployment/version   |
| ------------------- | -------------------------------------- |
| Vercel web          | `dpl_CbbZVUWuD4cUna2ABitvoAzWAAan`     |
| Booking short links | `2b8ab953-2273-4506-8308-8ca0265dde85` |
| Email queue gateway | `3a388ece-c200-4e37-b9d6-f8e701769e1c` |
| SMS summary gateway | `2622398b-e398-4992-96f4-9be1d3d1c467` |
| Operational control | `c3561950-5397-4ecc-b9e6-0feb31ae21b7` |

The web project is `prj_Tcr3HKMSJLo66DXNh5nUc8ggIUrl`; its custom staging environment is `env_wFNfYzdHzzgxeKNHnxXGv8LtdRNn`. Both `https://nabatable-staging.vercel.app` and `https://nabatable-staging-ops.vercel.app` point to that deployment/environment. Its immutable URL is `https://nabatable-staging-mfasrmokj-lapen-inns-projects.vercel.app`.

Fresh independent checks verified HTTP 302 without Vercel protection bypass, HTTP 401 with missing or invalid application monitoring credentials, and HTTP 200 with both credentials and the exact source revision on all three web URLs. Vercel protection remains enabled. All customer Workers returned authenticated readiness 200, unauthorized readiness 401, and unauthorized internal mutation 401. Operational readiness and unauthenticated heartbeat rejection passed.

## Changes verified in staging

- Replaced only the isolated dependency symlink with its own frozen-lockfile installation. Vercel prebuilt traces no longer referenced the original checkout, and the production-mode staging build and deployment succeeded.
- Restored per-job email callback outcomes required by the queue consumer; retained signature verification without requiring email-sending credentials at module initialization.
- Bound source revision into Vercel runtime environment, retained exact-revision checks, and scoped automation protection credentials to the staging origins.
- Supported the explicitly configured HTTPS ops origin, kept Vercel cookies host-only, and omitted invalid `www` canonicalization for complete Vercel alias hostnames.
- Corrected native Worker fetch invocation and enabled Cloudflare public fetch routing for same-account Worker readiness probes.
- Preserved the Supabase client receiver for atomic table unassignment. The original HTTP 500 occurred before any database request. A real-client regression reproduced it; staging now returns 200 and independently confirms removal of the assignment.

## Executable verification

`pnpm verify` passed on the stable runtime source: 7,466 root tests passed, 5 skipped, and 221 Worker tests passed (41 booking, 12 email, 26 SMS, 142 operational). Coverage gates, formatting, lint, type checks, workspace checks, governance checks, dead-code and duplication gates passed. Root statement coverage was 70.75%; line coverage was 71.97%. A separate Vercel production-mode staging build passed. Independent focused review found no additional blocker in the receiver, routing, protection or email-contract changes.

The final staging proof outcome is recorded below after its run. The final test-only separation of automatic lifecycle and manual reassignment also receives targeted lint, formatting and type checks. A deliberately failing database regression must remain visible; this is not a completely green staging release.

The final hosted staging pack ran 35 tests: **31 passed, 1 failed, 3 skipped**. The failing test is the manual reassignment regression described below. Passed proofs include guest create/replay, recovery read/cancel/terminal behavior, cross-tenant denials, genuine tenant membership RLS, host separation, authenticated ops automatic assignment/check-in/completion/terminal rejection and dashboard rendering, email persistence/dedupe/consumer completion/retry/DLQ, real queued SMS sink consumption, short-link persistence, and webhook signature/replay handling. The full report retains the failure; it is not marked skipped or expected-success.

Browser checks rendered the synthetic public booking route, changed party size from one to two, and verified ops dashboard redirection to sign-in. Both origins obtained separate Secure, HttpOnly, host-only Vercel protection cookies. No page errors were observed. Screenshots and the browser readback are archived outside the test runner's output directory.

Only synthetic staging tenants were used. The helper independently checked the deployed SMS `sink` setting and staging email mock configuration. Public guest contacts use reserved domains and unused numbers from Ofcom's London drama range; repeated fixtures must not pair a new email with an existing phone, because the strict public identity guard correctly rejects that partial match. No real guest messages were authorized or sent by these proofs.

## Remaining staging database blocker

Manual reassignment is not fixed. A fresh synthetic booking produced this independently verified sequence:

1. Create: confirmed with one synthetic table.
2. Unassign: HTTP 200, `removedCount: 1`.
3. Read back: pending with zero table assignments.
4. Reassign the same table under a fresh idempotency key: HTTP 409, SQLSTATE `23505`, constraint `booking_assignment_idempotency_booking_hash_key`.
5. Cleanup: scoped cancellation returned 200.

The manual-unassign RPC deletes assignments but retains allocator idempotency state. Existing terminal/modification cleanup RPCs clear that state. A new forward-only atomic migration is needed, preserving the booking lock, unique constraints, service-role-only grants, and correct partial-unassignment semantics. Validate assign → unassign → fresh-key reassign, partial removal, no-op removal, unrelated-booking isolation and retained conflict enforcement before applying it. Do not reuse an obsolete key, accept the conflict as success, or mutate the ledger from application code.

No Supabase migration was applied in this run. The provided credential bundles and generated staging environment do not contain a verified database deployment connection. The authoritative remote allocator/ledger definitions and executable SQL regression environment must be established through the governed database path before changing this invariant. A complete remote schema/promotion proof is not established by application readiness.

Three advanced staging proofs also remain unfinished: controlled hold/capacity contention, WhatsApp-to-SMS fallback under a controlled provider failure, and monotonic persisted state after out-of-order delivery callbacks. Sink success or an acknowledged callback does not prove those journeys.

## Monitoring and excluded integrations

The stored R2 cycle at 2026-09-06T08:20:44.416Z reported all four public probes healthy with HTTP 200 and evidence persistence successful. Overall `valid` remained `false`: controller_heartbeat_unknown, active_incidents. It recorded 1 active incident and zero processed or dispatched control-plane jobs. This verifies public probes and stored evidence; it does not establish controller integration or full operational readiness.

The local controller's launchd label was not loaded on the current user session; repository webhook inventory was empty. No controller start, GitHub workflow dispatch or external alert provider was added. The evidence must not be made valid by fabricating a heartbeat or acknowledging incidents without operational authorization.

## Production and release gates

PR #142 is **merged**, at `35abff5ef82a89bba16cd645487b8b74e5f6b6a6` on 2026-09-05 at 22:12:48 UTC. Fresh read-only checks still verified that revision on the three production customer Workers, including required bindings and unauthorized-request rejection. Production operational control remains on its prior release; it was not promoted with this branch.

At 2026-09-06T08:21:49.289Z, production `https://app.nabatable.com/api/ready` still returned HTTP 401 with the configured monitoring credential; the apex returned HTTP 307 to `www`. The configured production web monitoring token has not been activated by a verified deployment in this continuation. The production operational Worker independently reported `7a9a29114c74a851e17e1fa832b24f9ad3ed3e3f` and readiness 200.

No production deployment or promotion occurred during this continuation. Staging still has the manual-reassignment blocker. Independently, production delivery requires the candidate on protected main, a fresh exact-SHA `main-deploy` Release gate decision, recovery evidence, and database/separation checks before even an immutable production deployment. Direct use of a helper cannot replace that chain. GitHub Actions is excluded and the controller is paused, so no new gate evidence was manufactured. This branch's draft PR is reviewable but unmerged and not production-approved.

## Evidence retention and rollback

Current receipts/readbacks are in `test-results/deploy/`; live proof results are in `test-results/staging/`. They are ignored operational artifacts. External copies are in `/tmp/nabatable-runtime-evidence-20260906/`, including prior attempts and browser screenshots; the full validation log is `/tmp/nabatable-runtime-final-verify.log`. The safe manual-reassignment diagnostic is `/tmp/nabatable-ops-conflict-safe.json`.

During an earlier diagnostic, an ad hoc Playwright configuration used the default output directory and cleared the isolated checkout's ignored `test-results` tree, including historical deployment logs. This did not change the original checkout or provider state. Current provider readbacks and new deployment receipts were regenerated and backed up externally. They are fresh evidence, not recovered originals. The refreshed `test-results/deploy/RELEASE-2026-09-05.md` supersedes the lost historical note and corrects its stale claim that PR #142 was unmerged.

Each current Worker receipt records its previous version and rollback command. A staging rollback must preserve the protection, mock/sink configuration, target separation and source-revision evidence. Reverting the Supabase receiver fix would restore the known unassignment HTTP 500 and would not resolve the separate ledger defect. No database rollback is necessary for this continuation because no Supabase migrations were applied.

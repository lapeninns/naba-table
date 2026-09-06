# Runtime integration status — 2026-09-06

This is a staging verification and release handoff, not production promotion approval. Work ran in the isolated `/tmp/nabatable-backend-release-c3dc07c` checkout on `codex/remaining-runtime-integrations`. The original checkout and its dependency installation were left alone.

## Release identity

The web application and all four staging Workers were deployed and independently verified at `59f1fdd4e74c21c6e563a0e8e062257330f8f7ea`. Both forward database repairs are applied to staging, including atomic table-hold admission. Later proof and documentation commits are not represented as newly deployed web or Worker runtime revisions.

| Staging component   | Verified provider deployment/version   |
| ------------------- | -------------------------------------- |
| Vercel web          | `dpl_CbXMZaixERwRjcYCcwLKFQqudx3c`     |
| Booking short links | `d1f7e616-f04c-4905-aca7-880b152f8d78` |
| Email queue gateway | `6b1d417b-0be5-438c-922d-d59e99a05ff7` |
| SMS summary gateway | `4fdb43da-22c4-423b-b9d0-4d706515adbd` |
| Operational control | `f2ea3c1a-6bf6-44ef-a8a3-621bf404a381` |

The web project is `prj_Tcr3HKMSJLo66DXNh5nUc8ggIUrl`; its custom staging environment is `env_wFNfYzdHzzgxeKNHnxXGv8LtdRNn`. Both `https://nabatable-staging.vercel.app` and `https://nabatable-staging-ops.vercel.app` point to that deployment/environment. Its immutable URL is `https://nabatable-staging-9co44661c-lapen-inns-projects.vercel.app`.

Independent checks at 2026-09-06T11:08Z verified HTTP 302 without Vercel protection bypass, HTTP 401 with missing or invalid application monitoring credentials, and HTTP 200 with both credentials and the exact source revision on all three web URLs. Vercel protection remains enabled. All customer Workers returned authenticated readiness 200, unauthorized readiness 401, and unauthorized internal mutation 401. Operational readiness and unauthenticated heartbeat rejection passed.

## Changes verified in staging

- Replaced only the isolated dependency symlink with its own frozen-lockfile installation. Vercel prebuilt traces no longer referenced the original checkout, and the production-mode staging build and deployment succeeded.
- Restored per-job email callback outcomes required by the queue consumer; retained signature verification without requiring email-sending credentials at module initialization.
- Bound source revision into Vercel runtime environment, retained exact-revision checks, and scoped automation protection credentials to the staging origins.
- Supported the explicitly configured HTTPS ops origin, kept Vercel cookies host-only, and omitted invalid `www` canonicalization for complete Vercel alias hostnames.
- Corrected native Worker fetch invocation and enabled Cloudflare public fetch routing for same-account Worker readiness probes.
- Preserved the Supabase client receiver for atomic table unassignment. The original HTTP 500 occurred before any database request. A real-client regression reproduced it; staging now returns 200 and independently confirms removal of the assignment.

## Executable verification

`pnpm verify` passed on the stable runtime source: 7,491 root tests passed, 5 skipped, and 221 Worker tests passed (41 booking, 12 email, 26 SMS, 142 operational). Coverage gates, formatting, lint, type checks, workspace checks, governance checks, dead-code and duplication gates passed. Root statement coverage was 70.77%; line coverage was 71.99%. A separate Vercel production-mode staging build passed. Independent focused review found no additional blocker in the receiver, routing, protection or email-contract changes.

The deployed staging pack was rerun after the database migration. The original failing regression is retained as an ordinary required test and now passes.

The final post-migration hosted staging pack ran 36 tests: **34 passed, zero failed, two skipped** (2.7 minutes). Both fixture cleanup checks passed. Both manual reassignment and persisted out-of-order SMS callback behavior now pass. Passed proofs include guest create/replay, recovery read/cancel/terminal behavior, cross-tenant denials, genuine tenant membership RLS, host separation, authenticated ops automatic assignment/check-in/completion/terminal rejection and dashboard rendering, email persistence/dedupe/consumer completion/retry/DLQ, real queued SMS sink consumption, short-link persistence, and webhook signature/replay handling. The callback proof creates an inert, processed synthetic notification and queued attempt without invoking dispatch, sends signed delivered → sent → queued → delivered callbacks, and verifies through the authenticated ops API that the persisted state stays delivered after each event. Fixture cleanup was independently verified. Repeated guest create/replay runs initially exhausted an old synthetic slot; the test now selects an available slot through the shipped availability API, reuses the exact payload for replay, and cancels its own fixture with a readback. The capacity limit and HTTP 201/200 assertions remain unchanged. An isolated transport failure in the malformed-request test passed on recheck without a code change. A later full run had 33 passes, one guest-test timeout and two skips. Safe request-step labels and 15-second request bounds were added without increasing the overall timeout; the isolated complete guest create/replay/cancel/readback proof then passed in 14.9 seconds. A subsequent runner setup connection failure was retried once; the final full pack passed. Prior unsuccessful attempts remain archived.

Browser checks rendered the synthetic public booking route, changed party size from one to two, and verified ops dashboard redirection to sign-in. Both origins obtained separate Secure, HttpOnly, host-only Vercel protection cookies. No page errors were observed. Screenshots and the browser readback are archived outside the test runner's output directory.

Only synthetic staging tenants were used. The helper independently checked the deployed SMS `sink` setting and staging email mock configuration. Public guest contacts use reserved domains and unused numbers from Ofcom's London drama range; repeated fixtures must not pair a new email with an existing phone, because the strict public identity guard correctly rejects that partial match. No real guest messages were authorized or sent by these proofs.

## Manual table reassignment repair

The original deployed regression reproduced create → unassign (200, removed one) → pending/zero assignments → fresh-key reassign (409, SQLSTATE `23505`, `booking_assignment_idempotency_booking_hash_key`). The unassignment RPC retained allocation and idempotency state after deleting assignments.

Forward migration `20260906110000_atomic_manual_assignment_release.sql` now releases that state inside the existing database transaction. It locks the booking and sorted inventory rows, invalidates affected ledger entries, archives released allocations, preserves surviving partial merge groups, leaves zero-removal calls unchanged, and keeps both canonical and legacy-wrapper execution service-role-only. It does not perform a historical orphan-data sweep.

Independent review found no blocker. The existing staging schema failed the new rollback SQL assertion while the other three suites passed. Applying the candidate within each test transaction made all four suites pass, with rollback verified after every file. A separate three-session concurrency proof confirmed the canonical RPC waits on the booking lock, returns the expected removed count after release, and restores scoped data, function definitions and ACLs exactly after rollback.

The manual-release guarded staging plan reported 120 applied, one pending, zero remote-only migrations. After the manual-release migration the plan reported 121 applied. After the additional atomic hold migration, the fresh plan reports **122 applied, zero pending, zero remote-only**, and the complete five-file SQL pack passes against the applied schema with every rollback verified. Historical migration checksums remain unchanged. Database access used an authenticated temporary CLI role with its existing `postgres` membership and Supabase's published CA with certificate verification enabled; no credentials are recorded here. Production schema has not been changed.

## Atomic table-hold admission repair

The new staff contention proof reproduced two successful holds for the same table. Forward migration `20260906130000_atomic_table_hold_admission.sql` and the application RPC call make admission atomic under sorted inventory locks, with tenant/resource checks, active-window projection and writer guards. Cancellation releases holds atomically. The staff confirmation route creates the assignment while preserving the pending booking status; booking confirmation is a separate domain operation.

The candidate five-file SQL pack passed with rollback verified, and all five suites passed again against the applied staging schema. Independent three-session concurrency verification observed the contender blocked on inventory, then created exactly one member/window after the holder rolled back; final hashes were identical and no fixture transaction committed. Repeatable-read admission was rejected. The first deployment attempt refused at the initial lock statement because the CLI did not supply an outer transaction; readback confirmed no migration or function was applied. An explicit transaction wrapper was reviewed, tested and recorded only for the still-unapplied migration before a successful retry. Previously applied migration checksums were not edited.

The focused live staff proof passed: one winning hold, one assignment to the requested synthetic table, both booking statuses pending, and verified cancellation/zero residual holds. This does not establish the separate concurrent guest booking confirmation journey. The full `pnpm verify` ran on the atomic-hold implementation before the transaction-wrapper-only commit; 51 targeted migration safety tests and the real database suites passed after that wrapper change. A separate final staging production build passed at the deployed revision.

Two advanced staging proofs remain explicitly skipped: concurrent guest booking contention resulting in exactly one confirmed booking, and WhatsApp-to-SMS fallback under a controlled provider failure. Sink success does not prove fallback. Staff hold contention and persisted out-of-order callbacks are now proven separately.

## Monitoring and excluded integrations

The stored R2 cycle at 2026-09-06T11:10:44.644Z reported all four public probes healthy with HTTP 200 and evidence persistence successful. Overall `valid` remained `false`: controller_heartbeat_unknown, active_incidents. It recorded 1 active incident and zero processed or dispatched control-plane jobs. This verifies public probes and stored evidence; it does not establish controller integration or full operational readiness.

The local controller's launchd label was not loaded on the current user session; repository webhook inventory was empty. No controller start, GitHub workflow dispatch or external alert provider was added. The evidence must not be made valid by fabricating a heartbeat or acknowledging incidents without operational authorization.

## Production and release gates

PR #142 is **merged**, at `35abff5ef82a89bba16cd645487b8b74e5f6b6a6` on 2026-09-05 at 22:12:48 UTC. Fresh read-only checks still verified that revision on the three production customer Workers, including required bindings and unauthorized-request rejection. Production operational control remains on its prior release; it was not promoted with this branch.

At 2026-09-06T11:18:19.984Z, production `https://app.nabatable.com/api/ready` still returned HTTP 401 with the configured monitoring credential; the apex returned HTTP 307 to `www`. The configured production web monitoring token has not been activated by a verified deployment in this continuation. The production operational Worker independently reported `7a9a29114c74a851e17e1fa832b24f9ad3ed3e3f` and readiness 200.

No production deployment or promotion occurred during this continuation. Both database repairs are applied to staging. Independently, production delivery requires the candidate on protected main, a fresh exact-SHA `main-deploy` Release gate decision, recovery evidence, and database/separation checks before even an immutable production deployment. Direct use of a helper cannot replace that chain. GitHub Actions is excluded and the controller is paused, so no new gate evidence was manufactured. This branch's draft PR is reviewable but unmerged and not production-approved.

The read-only release audit found that required CodeQL and Service-role route authorization jobs were refused before execution because GitHub reported failed account payments or a spending limit restriction. `Release gate` and `Local CI / pr` evidence are absent. Protected-main policy still contains an unqualified image-digest placeholder; the local trust policy has a placeholder repository ID and no authorized actors. Recovery resource placeholders remain, the recovery-drill workflow has no runs, and both observed backup workflow runs failed. This does not establish whether out-of-band backups exist. Direct deployment is not a substitute for exact-SHA gate approval, a fresh verified backup and a successful restore drill. No GitHub workflows were dispatched to work around the user's explicit exclusion.

## Evidence retention and rollback

Current receipts/readbacks are in `test-results/deploy/`; live proof results are in `test-results/staging/`. They are ignored operational artifacts. External copies are in `/tmp/nabatable-runtime-evidence-20260906/`, including prior attempts and browser screenshots; the final full validation log is `/tmp/nabatable-hold-final-verify.log`. Atomic hold SQL, concurrency, build and staging pack logs are retained under `/tmp/nabatable-hold-*` and copied into the evidence archive. The safe manual-reassignment diagnostic is `/tmp/nabatable-ops-conflict-safe.json`.

During an earlier diagnostic, an ad hoc Playwright configuration used the default output directory and cleared the isolated checkout's ignored `test-results` tree, including historical deployment logs. This did not change the original checkout or provider state. Current provider readbacks and new deployment receipts were regenerated and backed up externally. They are fresh evidence, not recovered originals. The refreshed `test-results/deploy/RELEASE-2026-09-05.md` supersedes the lost historical note and corrects its stale claim that PR #142 was unmerged.

Each current Worker receipt records its previous version and rollback command. A staging rollback must preserve the protection, mock/sink configuration, target separation and source-revision evidence. Reverting the Supabase receiver fix would restore the known unassignment HTTP 500 and would not resolve the separate ledger defect. Both forward migrations are applied to staging only. A database rollback would require a separately reviewed forward repair; reverting it to the prior functions would reintroduce the verified allocation/idempotency and concurrent-hold defects. Do not edit applied migration history.

# Task 4 WhatsApp review ledger evidence

## Scope

- Spec: `MS-data-whatsapp-review-ledger`
- Runtime surfaces: mobile router, WhatsApp callback reconciliation, mobile notification ledger
- Remote boundary: staging only; production was not accessed

## Baseline

- `pnpm exec vitest run tests/micro-specs/mobile-notification-ledger.test.ts tests/server/notifications/mobile-router.test.ts tests/server/twilio-whatsapp-status-webhook-route.test.ts`
- Result before edits: 3 files passed, 14 tests passed.
- Existing lifecycle behavior characterized: confirmation/update/cancellation dispatch WhatsApp first and claim one SMS fallback on pre-accept or terminal delivery failure.

## RED evidence

- Router/callback command: `pnpm exec vitest run tests/server/notifications/mobile-router.test.ts`
- Result: 4 intended failures, 9 passes.
- Failures proved review requests incorrectly sent SMS for an unstorable phone, claimed direct SMS when ineligible or missing a template, claimed fallback after pre-accept failure, and claimed callback fallback after an undelivered status.
- Migration command: `pnpm exec vitest run tests/micro-specs/mobile-notification-ledger.test.ts`
- Result: 3 intended failures, 3 passes because the review expansion migration did not exist.

## GREEN evidence

- Focused command: `pnpm exec vitest run tests/micro-specs/mobile-notification-ledger.test.ts tests/server/notifications/mobile-router.test.ts tests/server/twilio-whatsapp-status-webhook-route.test.ts`
- Result: 3 files passed, 29 tests passed after adversarial coverage was added.
- Follow-up RED: 1 intended SQL-proof failure and 28 passes proved the attempt-recipient mismatch case was absent before it was added.
- Review eligibility proof is split between ineligible-with-template and eligible-without-template; callback proof covers both `failed` and `undelivered` terminal states.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed, including strict shadcn and Micro-Spec guards.
- `QA_EXTERNAL_MUTATION_MODE=mock pnpm qa:background-workers`: 19 files passed, 133 tests passed.
- TypeScript no-excuse audit: no violations in the four changed TypeScript/test files.
- Scoped governance validation over the nine Task 4 files: passed with zero failures.
- `pnpm test`: one unrelated pre-existing timeout in `tests/server/capacity/planner-stress.test.ts` at the suite's 5-second budget; its 13 tests passed with `--testTimeout=15000`.
- `pnpm build`: blocked in prebuild because the isolated worktree does not currently expose the three required Supabase variables.
- Recorded governance run: stopped at global governance because another worker's `next-env.d.ts` and two Task 2 PNG artifacts are outside every active spec radius; the exact failing run is preserved in the spec ledger.

## Database evidence and blocker

- Linked remote readback: `pnpm db:status` connected to project ref `ndxmivcrehsacuerwxtm`, named `nabatable-staging-synth`.
- Readback showed `20260711143000` applied and `20260712204500` pending.
- `pnpm validate:env` failed because `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are absent from this isolated worktree.
- The binding `pnpm db:migrate` command points to `scripts/db/safe-run.ts`, but that file is absent. The staging migration was therefore not applied and the transactional SQL invariant proof was not run remotely.
- No production project, schema, row, provider, or deployment was mutated.

## Invariants implemented

- `booking_review_request` is an allowed notification type.
- A partial unique index permits one logical review notification per restaurant, booking, notification type, and recipient snapshot.
- A tenant trigger rejects review notifications whose booking is absent or belongs to another restaurant.
- An attempt-policy trigger keeps attempt recipients aligned and rejects direct review SMS attempts.
- The fallback RPC explicitly rejects review notifications before inspecting or inserting an SMS fallback.
- The router suppresses direct and fallback SMS for invalid, ineligible, missing-template, and pre-accept review failures.
- Callback reconciliation loads the notification type, applies compare-and-set monotonic status, and stops review failures before fallback.
- Duplicate jobs, duplicate callbacks, and out-of-order callbacks do not add a WhatsApp or SMS attempt.
- The four lifecycle event paths retain existing SMS fallback behavior.

## Manual surface QA

- Dependency-injected router path exercised with a review template and recipient snapshot: accepted WhatsApp produced one WhatsApp send and zero SMS sends.
- Dependency-injected reconciliation path exercised with an `undelivered` review status: one terminal update and zero fallback claims/sends.
- Signed callback route exercised with `MessageSid=MM123`, `MessageStatus=undelivered`, `ErrorCode=63016`, and `To=whatsapp:+447123456789`: HTTP 200 and exact parsed callback payload.
- Invalid signature exercised: HTTP 401 and zero callback processing.

## Adversarial receipt

- Malformed callback: invalid signature covered; unsupported/missing provider fields are pre-existing route guards and unchanged.
- Tenant mismatch: enforced in SQL and encoded in the transactional staging proof; remote execution blocked as documented.
- Attempt recipient mismatch: encoded as an expected `check_violation` in the transactional staging proof.
- Duplicate/out-of-order callback: covered and green.
- Stale terminal state: covered and green.
- Dirty worktree: unrelated shared-worker edits were preserved; no revert, cleanup, staging, or commit was performed.
- Flaky tests: focused suite repeated green without wall-clock waits.
- Misleading output: staging status is explicitly read-only; no claim of migration application is made.
- Repeated interruption: N/A.

## Cleanup receipt

- Database rows created: none.
- Provider messages sent: none.
- Remote configuration changed: none.
- Temporary local files outside the task evidence and governed implementation radius: none.

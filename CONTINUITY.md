# Continuity Ledger

Last updated: 2026-03-29T10:36:30Z

## Goal (incl. success criteria)

- Keep production email delivery stable while landing the ledger-backed cutover and related production data operations safely.
- Success means the Cloudflare-backed production path remains healthy, the email-intent ledger rollout history is preserved, and the Old School House to Old Crown booking move remains documented with evidence.

## Constraints/Assumptions

- Work only in the current repo workspace or isolated mission worktree as applicable to the task.
- Supabase remains remote-only; no local DB work.
- Production-style data operations still require task artifacts, rollback notes, and evidence.
- Direct Postgres auth from `.env.vercel-production` is failing in this workspace, so production operations must use the service-role Supabase HTTP path when direct Postgres is unavailable.
- The Cloudflare gateway Worker still exists for non-email responsibilities (`RateLimitState`, `CapacityVersionState`), so email cutover changes must not regress production behavior.

## Key decisions

- Introduce `public.email_dispatch_intents` as the canonical store for future reminder/review sends, while preserving compatibility views and operational visibility.
- Keep `server/queue/email.ts` as a compatibility facade, but repoint it to the ledger instead of the Durable Object email gateway.
- Restore `/api/cron/process-emails` coverage and preserve queue-style statuses (`waiting`, `active`, `delayed`, `dlq`) as derived compatibility views over ledger rows.
- Create dedicated operational task folders before touching remote Supabase data.
- For venue booking moves, treat `public.bookings.restaurant_id` as the primary field to inspect first, verify dependent tables before any update, and capture before/after evidence for rollback.
- Clear venue-specific assignment state before a venue swap: table assignment, allocation, assignment idempotency, zone lock, and confirmation cache.

## State

- The hybrid email-intent cutover is implemented in code, and the Cloudflare-backed production path is confirmed working.
- Staging rollout for `public.email_dispatch_intents` and `public.claim_due_email_dispatch_intents` completed with migration `20260327090000` registered.
- Production rollout for `public.email_dispatch_intents` and `public.claim_due_email_dispatch_intents` completed with migration `20260327090000` registered, `service_role` execute privileges verified, and runtime deploys validated.
- Controlled provider and ledger validation succeeded in production, including the serializer fix deploy.
- The Old School House to Old Crown booking move has been executed and verified.
- Task artifacts exist for `tasks/move-old-school-house-bookings-to-old-crown-20260329-0720/`.
- Old School House now has zero bookings; Old Crown has the moved booking.

## Done

- Created `tasks/hybrid-email-intents-and-cloudflare-cutover-20260327-0853/`.
- Created `tasks/email-intents-db-rollout-20260327-0946/`.
- Added `server/queue/email-contract.ts` and `server/queue/email-intents.ts`.
- Added `supabase/migrations/20260327090000_add_email_dispatch_intents.sql`.
- Repointed `server/queue/email.ts` from gateway-backed queue operations to ledger-backed scheduling, cancellation, status, and drain behavior.
- Updated `server/jobs/booking-side-effects.ts` to schedule reminders/review requests into the ledger and cancel stale intents on invalidating status transitions.
- Updated `/api/cron/process-emails` and `/api/admin/queue-status` to stop depending on email gateway configuration for core email processing and visibility.
- Restored `/api/cron/process-emails` in `vercel.json`.
- Relaxed the environment validator so `FEATURE_EMAIL_QUEUE_ENABLED=true` no longer requires email gateway URL/token for the email path.
- Created `tasks/audit-email-queue-gateway-migration-20260327-0840/` and documented the remaining Durable Object email gateway responsibilities, retry/failure behavior, native Cloudflare Queue gaps, and preserve/remove recommendations.
- Applied the email-intent migration on staging and production, registered migration version `20260327090000`, and verified table/RPC presence plus `service_role` execute privilege.
- Verified the live production cron route responds successfully with `No pending emails to process`.
- Verified production still has fresh `review_request` delivery-log entries while the new ledger table remains empty.
- Sent a controlled production validation email and confirmed provider-side delivery.
- Traced a fresh production booking and confirmed delayed reminder scheduling still lands in the legacy Cloudflare gateway, not the new ledger.
- Added/committed a real in-repo `next-env.d.ts` and stopped ignoring it in `.gitignore` so Vercel production builds no longer depend on a machine-local symlink.
- Fixed `server/queue/email-intents.ts` so ledger timestamps are serialized to ISO datetimes before passing through `emailJobPayloadSchema`.
- Deployed the fixed runtime to the live production Vercel project and confirmed cron-based ledger processing succeeds on production.
- Created `tasks/assign-tables-atomic-duplicate-fix-20260327-1301/`.
- Patched `server/capacity/table-assignment/policy-retry.ts` so automated `atomicConfirmAndTransition` flows recover once from retryable assignment conflicts by releasing the stale hold, re-quoting, and retrying confirm.
- Added `tests/server/capacity/policy-retry.test.ts` covering conflict recovery and re-quote failure.
- Read the root AGENTS instructions and the MCP/Continuity skills relevant to remote Supabase work.
- Located existing repo scripts for Supabase inspection and SQL execution.
- Created `tasks/move-old-school-house-bookings-to-old-crown-20260329-0720/` with research, plan, todo, and verification stubs.
- Verified live production restaurant IDs:
  - Old School House `a120da71-ba6d-446f-a33a-2e78787abcb0`
  - Old Crown `a050d1ad-1ee0-4ea0-abc2-22c3778aa52c`
- Captured preflight evidence in `artifacts/preflight.txt`.
- Moved booking `2fd69938-1e03-48c3-a776-34fa4bd3ab36` / ref `LYAGFXAT3Y` from Old School House to Old Crown.
- Moved linked customer `c120ec30-295b-4f63-bdca-c8cbaebbcece` to Old Crown because it only belonged to that booking.
- Cleared stale table assignment, allocation, assignment idempotency, zone lock, and confirmation cache state for the moved booking.
- Updated the related analytics event restaurant ID to Old Crown.
- Captured execution and postflight evidence in `artifacts/execution.txt` and `artifacts/postflight.txt`.

## Now

- Resolve the current merge cleanly and push the verified production-safe state to both remotes.

## Next

- Confirm a naturally created post-deploy delayed email writes a row to `public.email_dispatch_intents`.
- Decide whether to add a native Cloudflare Queue consumer as a second-stage transport, or keep cron+ledger processing as the canonical mechanism.
- Clean up the older duplicate migration version prefixes in `supabase/migrations/` so CLI-based migration flows are safe again.
- Remove or repurpose the legacy Cloudflare email gateway smoke/docs once the production cutover is confirmed.
- Verify the assignment-conflict retry fix on a fresh production inline auto-assign booking.
- No immediate follow-up is required for the completed Old School House to Old Crown move unless a new booking needs the same treatment.

## Open questions (UNCONFIRMED if needed)

- None for the completed venue move.
- Should the legacy Cloudflare email gateway smoke script remain gateway-specific, or should it be replaced with a ledger/cron smoke flow after production validation?
- How long should legacy Cloudflare delayed jobs be allowed to drain before the old gateway path is fully retired from ops visibility?

## Working set (files/ids/commands)

- `CONTINUITY.md`
- `AGENTS.md`
- `tasks/move-old-school-house-bookings-to-old-crown-20260329-0720/`
- `tasks/hybrid-email-intents-and-cloudflare-cutover-20260327-0853/`
- `tasks/email-intents-db-rollout-20260327-0946/`
- `tasks/audit-email-queue-gateway-migration-20260327-0840/`
- `scripts/debug-restaurants.ts`
- `scripts/execute-sql.ts`
- `scripts/purge-restaurant-bookings.ts`
- `server/queue/email-contract.ts`
- `server/queue/email-intents.ts`
- `server/queue/email.ts`
- `server/queue/email-processing.ts`
- `server/jobs/booking-side-effects.ts`
- `src/app/api/cron/process-emails/route.ts`
- `src/app/api/admin/queue-status/route.ts`
- `src/app/api/ops/email-queue/route.ts`
- `types/emailQueue.ts`
- `types/supabase.ts`
- `supabase/migrations/20260327090000_add_email_dispatch_intents.sql`
- `scripts/validate-env.ts`
- `vercel.json`
- `git diff --check`
- `pnpm typecheck` (blocked until deps are present in the mission worktree)
- `.env.vercel-production`
- production service-role Supabase queries via inline `pnpm -s tsx`

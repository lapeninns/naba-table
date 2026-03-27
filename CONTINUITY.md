# Continuity Ledger

Last updated: 2026-03-27T09:13:56Z

## Goal (incl. success criteria)

- Complete the hybrid email-intent cutover so delayed reminder/review scheduling no longer depends on the Durable Object email queue gateway.
- Success means delayed email scheduling writes to a DB-backed ledger, cron drains due intents through the shared email processor, ops/admin queue visibility reads from the ledger, and the old email gateway is no longer the canonical source of truth.

## Constraints/Assumptions

- Work only in the isolated mission worktree.
- Supabase remains remote-only; schema changes are recorded as migrations and not applied locally.
- The workspace currently has no `node_modules`, so automated repo checks are blocked unless dependencies are installed.
- The Cloudflare gateway Worker still exists for non-email responsibilities (`RateLimitState`, `CapacityVersionState`), so this cutover is email-specific.

## Key decisions

- Introduce `public.email_dispatch_intents` as the canonical store for future reminder/review sends.
- Keep `server/queue/email.ts` as a compatibility facade, but repoint it to the ledger instead of the Durable Object email gateway.
- Preserve queue-style ops statuses (`waiting`, `active`, `delayed`, `dlq`) as a derived compatibility view over ledger rows.
- Explicitly cancel stale reminder/review intents on status transitions instead of relying only on send-time skip checks.
- Restore `vercel.json` cron coverage for `/api/cron/process-emails`, since the ledger model depends on regular claiming.

## State

- The hybrid cutover is implemented in code: booking side effects write/cancel intents, cron claims/processes due intents, and queue visibility now reads from the ledger.
- The new migration file and Supabase type additions are present, but I have not applied the migration in a remote environment from this workspace.
- Verification is partial: `git diff --check` passes, but typecheck/tests could not run because dependencies are missing.

## Done

- Created `tasks/hybrid-email-intents-and-cloudflare-cutover-20260327-0853/`.
- Added `server/queue/email-contract.ts` and `server/queue/email-intents.ts`.
- Added `supabase/migrations/20260327090000_add_email_dispatch_intents.sql`.
- Repointed `server/queue/email.ts` from gateway-backed queue operations to ledger-backed scheduling, cancellation, status, and drain behavior.
- Updated `server/jobs/booking-side-effects.ts` to schedule reminders/review requests into the ledger and cancel stale intents on invalidating status transitions.
- Updated `/api/cron/process-emails` and `/api/admin/queue-status` to stop depending on email gateway configuration for core email processing/visibility.
- Restored `/api/cron/process-emails` in `vercel.json`.
- Relaxed the environment validator so `FEATURE_EMAIL_QUEUE_ENABLED=true` no longer requires email gateway URL/token for the email path.
- Created `tasks/audit-email-queue-gateway-migration-20260327-0840/` and documented the remaining Durable Object email gateway responsibilities, retry/failure behavior, native Cloudflare Queue gaps, and preserve/remove recommendations.

## Now

- Hand off the implemented hybrid email-intent cutover with the verification caveat that dependencies were not installed in this workspace.

## Next

- Apply the new migration in staging, then validate actual scheduling/drain behavior against remote Supabase.
- Decide whether to add a native Cloudflare Queue consumer as a second-stage transport, or keep cron+ledger processing as the canonical mechanism.
- Remove or repurpose the legacy Cloudflare email gateway smoke/docs once the production cutover is confirmed.

## Open questions (UNCONFIRMED if needed)

- Should the legacy Cloudflare email gateway smoke script remain gateway-specific, or should it be replaced with a ledger/cron smoke flow after staging validation?

## Working set (files/ids/commands)

- `CONTINUITY.md`
- `tasks/hybrid-email-intents-and-cloudflare-cutover-20260327-0853/`
- `tasks/audit-email-queue-gateway-migration-20260327-0840/`
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
- `pnpm typecheck` (currently blocked: missing `node_modules`)

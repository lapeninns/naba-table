# Continuity Ledger

Last updated: 2026-03-27T12:07:30Z

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
- Staging rollout is complete:
  - `public.email_dispatch_intents` exists on linked staging (`ndxmivcrehsacuerwxtm`)
  - `public.claim_due_email_dispatch_intents` exists
  - migration version `20260327090000` is registered in staging `supabase_migrations.schema_migrations`
- Production rollout is complete:
  - `public.email_dispatch_intents` exists on production (`vrdiqfudmwydclqpydee`)
  - `public.claim_due_email_dispatch_intents` exists on production
  - migration version `20260327090000` is registered in production `supabase_migrations.schema_migrations`
  - `service_role` can execute `public.claim_due_email_dispatch_intents(integer, text[])`
- Production runtime cutover is now live:
  - Vercel deployment `dpl_HcASnjbFDbSYusRdMo8JKdaLEKwM` deployed the ledger-backed runtime to the real `nabatable` production project
  - Vercel deployment `dpl_Du3GrYhpxVrcz37qM7NbavsvkAjX` deployed the follow-up fix for ledger timestamp serialization
  - final production aliases include `app.nabatable.com`, `www.nabatable.com`, `assets.nabatable.com`, and `nabatable.com`
- Direct provider validation succeeded:
  - a controlled production Resend send was accepted and reached `last_event = delivered`
- Booking-specific production validation now confirms the active delayed-email path is still legacy:
  - booking `f8514411-dfc7-451a-add2-ba2f8743efb8` (`LT4ACNL4SE`) exists for `oldschoolhouse@lapeninns.com`
  - immediate `created` email logged successfully
  - no ledger row exists for that booking in `email_dispatch_intents`
  - legacy Cloudflare gateway contains delayed job `reminder_short__f8514411-dfc7-451a-add2-ba2f8743efb8`
- Controlled live ledger validation succeeded after the runtime deploy:
  - seeded due intent `manual_validation__20260327T1158Z__updated__ec1bdba1` against booking `ec1bdba1-79a6-4b57-9b5c-0065cc8cf4b4` (`5938Q0HHBU`) with empty `customer_email`
  - production cron on `www.nabatable.com` claimed and processed the intent
  - final result after the serializer fix: `processed=1`, `sent=0`, `skipped=1`, `failed=0`
  - validation row was removed from production after verification
- Verification is now sufficient to declare the new ledger-backed production path live.

## Done

- Created `tasks/hybrid-email-intents-and-cloudflare-cutover-20260327-0853/`.
- Created `tasks/email-intents-db-rollout-20260327-0946/`.
- Added `server/queue/email-contract.ts` and `server/queue/email-intents.ts`.
- Added `supabase/migrations/20260327090000_add_email_dispatch_intents.sql`.
- Repointed `server/queue/email.ts` from gateway-backed queue operations to ledger-backed scheduling, cancellation, status, and drain behavior.
- Updated `server/jobs/booking-side-effects.ts` to schedule reminders/review requests into the ledger and cancel stale intents on invalidating status transitions.
- Updated `/api/cron/process-emails` and `/api/admin/queue-status` to stop depending on email gateway configuration for core email processing/visibility.
- Restored `/api/cron/process-emails` in `vercel.json`.
- Relaxed the environment validator so `FEATURE_EMAIL_QUEUE_ENABLED=true` no longer requires email gateway URL/token for the email path.
- Created `tasks/audit-email-queue-gateway-migration-20260327-0840/` and documented the remaining Durable Object email gateway responsibilities, retry/failure behavior, native Cloudflare Queue gaps, and preserve/remove recommendations.
- Applied the email-intent migration on staging via Supabase MCP `execute_sql`.
- Registered migration version `20260327090000` in staging `supabase_migrations.schema_migrations`.
- Verified staging table/RPC presence and a no-op claim call.
- Applied the production email-intent migration via the Supabase Management API `database/query` endpoint.
- Registered migration version `20260327090000` in production `supabase_migrations.schema_migrations`.
- Verified production table/RPC presence and `service_role` execute privilege.
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

## Now

- Hand off with production schema rollout complete and runtime cutover verified live.

## Next

- Confirm a naturally created post-deploy delayed email writes a row to `public.email_dispatch_intents`.
- Decide whether to add a native Cloudflare Queue consumer as a second-stage transport, or keep cron+ledger processing as the canonical mechanism.
- Clean up the older duplicate migration version prefixes in `supabase/migrations/` so CLI-based migration flows are safe again.
- Remove or repurpose the legacy Cloudflare email gateway smoke/docs once the production cutover is confirmed.
- Verify the assignment-conflict retry fix on a fresh production inline auto-assign booking.

## Open questions (UNCONFIRMED if needed)

- Should the legacy Cloudflare email gateway smoke script remain gateway-specific, or should it be replaced with a ledger/cron smoke flow after production validation?
- How long should legacy Cloudflare delayed jobs be allowed to drain before the old gateway path is fully retired from ops visibility?

## Working set (files/ids/commands)

- `CONTINUITY.md`
- `tasks/hybrid-email-intents-and-cloudflare-cutover-20260327-0853/`
- `tasks/email-intents-db-rollout-20260327-0946/`
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

---
task: hybrid-email-intents-and-cloudflare-cutover
timestamp_utc: 2026-03-27T08:53:42Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: high
flags: [FEATURE_EMAIL_QUEUE_ENABLED]
related_tickets: []
---

# Verification Report

## Code-path validation

- [x] Replaced delayed email scheduling with a DB-backed `email_dispatch_intents` ledger.
- [x] Replaced queue-drain behavior with `claim_due_email_dispatch_intents` + `processEmailJobs`.
- [x] Preserved retry semantics with fixed/exponential backoff and terminal failure state.
- [x] Preserved ops/admin queue payload shape by deriving queue-style statuses from the ledger.
- [x] Restored Vercel cron registration for `/api/cron/process-emails`.

## Commands

- `git diff --check`
  - Result: pass
- `pnpm typecheck`
  - Result: blocked because `node_modules` is missing in this workspace (`tsc: command not found`)

## Manual review notes

- `server/queue/email-intents.ts` is now the canonical source for:
  - intent scheduling/upsert
  - booking/type cancellation
  - queue snapshot derivation
  - due-intent claiming and retry/failure state transitions
- `server/jobs/booking-side-effects.ts` now explicitly cancels stale reminder/review intents when status transitions invalidate them.
- `src/app/api/cron/process-emails/route.ts` no longer depends on the Cloudflare email gateway configuration for GET drain runs.
- `src/app/api/admin/queue-status/route.ts` now reads ledger-backed status directly.

## Known gaps

- I could not run repo typecheck, Vitest, or any UI validation because this worktree does not have dependencies installed.
- The legacy Cloudflare email gateway deployment still exists for non-email responsibilities and for manual smoke scripts, but email scheduling state is no longer canonical there.

# Continuity Ledger

Last updated: 2025-12-27T00:24:57Z

## Goal (incl. success criteria)

- Implement Redis-backed scheduling for all booking emails (pre/post reminders, review requests, confirmations, updates, cancellations)
- Success: scheduling flow defined and integrated without exposing secrets (UNCONFIRMED)

## Constraints/Assumptions

- Follow AGENTS SDLC phases with task artifacts.
- Secrets never in source; use env vars/secret store; rotate leaked creds.
- Use existing patterns and keep scope narrow.

## Key decisions

- Queue all booking emails when `FEATURE_EMAIL_QUEUE_ENABLED=true`.
- Long-lived worker process is available for the email queue.

## State

- Implementation complete; pending review and optional tests.

## Done

- Read root `AGENTS.md` and continuity-ledger skill instructions.
- Located existing email scheduling/queue infrastructure via codebase-retrieval (BullMQ + Redis; booking reminders/review requests already scheduled in `server/jobs/booking-side-effects.ts`).
- Created task folder `tasks/email-scheduling-redis-20251226-2357/` with SDLC stubs.
- Updated research/plan/todo to reflect queue-all scope and long-lived worker.
- Added `scripts/queues/email-worker.ts` BullMQ worker with status guards and DLQ handling.
- Routed booking update and cancellation emails through the queue when enabled.
- Expanded email queue types to include `updated` and `cancelled`.
- Added env example doc for testing.
- Expanded env example with CLI/Node test snippets (placeholders only).

## Now

- Provide a ready-to-use Redis client example without embedding secrets; require secret rotation.

## Next

- Optional: run typecheck/lint/tests.
- Manual verification in staging with Redis and flag enabled.

## Open questions (UNCONFIRMED if needed)

- None.

## Working set (files/ids/commands)

- `CONTINUITY.md`
- `AGENTS.md`
- `tasks/email-scheduling-redis-20251226-2357/research.md`
- `tasks/email-scheduling-redis-20251226-2357/plan.md`
- `tasks/email-scheduling-redis-20251226-2357/todo.md`
- `tasks/email-scheduling-redis-20251226-2357/verification.md`
- `tasks/email-scheduling-redis-20251226-2357/artifacts/env.example.md`

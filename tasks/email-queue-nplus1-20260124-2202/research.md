---
task: email-queue-nplus1
timestamp_utc: 2026-01-24T22:02:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Email Queue N+1 Redis Spans

## Requirements

- Functional: Reduce Redis N+1 spans in `/api/cron/process-emails` while keeping job processing behavior the same.
- Non-functional: Keep change minimal; avoid new dependencies.

## Existing Patterns & Reuse

- Cron route uses BullMQ queue getters in `src/app/api/cron/process-emails/route.ts`.
- Queue setup lives in `server/queue/email.ts` and uses shared Redis connection.

## External Resources

- BullMQ job getters recommend batching with `getJobs`/`getJobCounts` to reduce Redis calls.
- Sentry N+1 performance issue detection highlights sequential spans of the same operation.

## Constraints & Risks

- Must not change email processing logic or delivery behavior.
- Avoid per-job state queries that add more Redis calls.

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- Replace `getDelayed`/`getWaiting` with `getJobs(['delayed','wait'])` and `getJobCounts` to batch Redis access.

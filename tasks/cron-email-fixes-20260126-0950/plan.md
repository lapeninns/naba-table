---
task: cron-email-fixes
timestamp_utc: 2026-01-26T09:52:43Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Cron email fixes

## Objective

We will reduce N+1 Redis `hgetall` calls in `GET /api/cron/process-emails` while preserving correct email processing.

## Success Criteria

- [ ] Cron processing still sends the same set of emails (no duplicates or skips).
- [ ] Redis calls per cron run are reduced (fewer per-job `hgetall` calls observed in tracing).
- [ ] Logs include enough context to diagnose skipped/failed jobs.

## Architecture & Components

- Cron endpoint: `src/app/api/cron/process-emails/route.ts`
- Email queue: `server/queue/email.ts`
- Redis connection: `lib/queue/redis.ts`
- Email worker (reference): `scripts/queues/email-worker.ts`

## Data Flow & API Contracts

- `GET /api/cron/process-emails` (Vercel cron, Bearer `CRON_SECRET`)
- Response JSON: `{ success, message, stats, results }` (keep stable)

## UI/UX States

- N/A (unless UI surfaces are added)

## Edge Cases

- Only delayed jobs exist and none are ready (should early-exit, no Redis churn).
- Waiting jobs exist but delayed jobs are also present (avoid double-fetch).
- Invalid booking/email or status guard skips (should still remove job safely).

## Testing Strategy

- Unit: selection logic for ready jobs (waiting vs delayed) with deterministic timestamps.
- Integration: cron route with mocked queue to assert reduced job fetch paths.

## Rollout

- Feature flag: none (cron endpoint behavior change only).
- Monitoring: Sentry issue 90916590; Vercel logs for cron route latency and job counts.
- Kill-switch: revert to previous selection logic.

## DB Change Plan (if applicable)

- Target envs: staging → production
- Backup reference: TBD
- Dry-run evidence: `artifacts/db-diff.txt`
- Backfill strategy: TBD
- Rollback plan: TBD

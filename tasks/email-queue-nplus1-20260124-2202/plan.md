---
task: email-queue-nplus1
timestamp_utc: 2026-01-24T22:02:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Email Queue N+1 Redis Spans

## Objective

Reduce Redis roundtrips in `/api/cron/process-emails` by using BullMQ batch getters while preserving existing processing logic.

## Success Criteria

- Cron route uses `getJobCounts` and `getJobs` for waiting/delayed jobs.
- No change to job processing semantics (ready job filtering remains).

## Architecture & Components

- `src/app/api/cron/process-emails/route.ts`: update job fetching logic only.

## Data Flow & API Contracts

- No changes to request/response schema.

## UI/UX States

- N/A (API-only change).

## Edge Cases

- Delayed jobs not yet ready should still be skipped.
- No waiting/delayed jobs returns existing "No pending" response.

## Testing Strategy

- LSP diagnostics on updated route.

## Rollout

- No flags; deploy with next release.

## DB Change Plan (if applicable)

- Not applicable.

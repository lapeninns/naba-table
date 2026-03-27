---
task: audit-email-queue-gateway-migration
timestamp_utc: 2026-03-27T08:40:58Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: medium
flags: [FEATURE_EMAIL_QUEUE_ENABLED]
related_tickets: []
---

# Implementation Plan: Durable Object Email Queue Gateway Migration Guidance

## Objective

We will document a migration path from the current Durable Object email queue gateway to native Cloudflare Queues plus consumer Workers without regressing delayed delivery, idempotency, operator visibility, or the unrelated gateway-backed services that still depend on the same Worker deployment.

## Success Criteria

- [x] Every responsibility in `server/queue/email.ts` is classified as remove, preserve, or replace.
- [x] Every responsibility in `cloudflare/email-queue-gateway/src/index.mjs` is classified as email-specific or non-email coupling.
- [x] Retry behavior, failure handling, and enqueue/dequeue flow are documented concretely.
- [x] Native Queue gaps are identified with an explicit recommendation.

## Architecture & Components

- App producer:
  - `server/jobs/booking-side-effects.ts`
  - `server/queue/email.ts`
- Current transport/orchestrator:
  - `cloudflare/email-queue-gateway/src/index.mjs`
- Current processor:
  - `src/app/api/cron/process-emails/route.ts`
  - `server/queue/email-processing.ts`
- Coupled non-email features in the same Worker:
  - `server/security/rate-limit.ts`
  - `server/capacity/cache.ts`

## Data Flow & API Contracts

- Current enqueue:
  - producer -> `POST /messages` -> DO storage + alarm
- Current processing:
  - DO alarm/manual drain -> `APP_PROCESS_EMAILS_URL` -> batch result -> DO success/retry/DLQ
- Proposed native Queue direction:
  - producer -> Cloudflare Queue
  - Queue consumer Worker -> shared processing logic
  - optional DB-backed scheduler promotes jobs whose delay exceeds native Queue limits

## Edge Cases

- `reminder_24h` jobs can exceed native Queue delay limits when the booking is created days in advance.
- Current app routes expect queue listings and counts, not just provider metrics.
- Queue dedupe today is tied to deterministic job ids and DO state; native Queue producers need an equivalent idempotency boundary.
- Current GET drain API only permits `review_request` filtering even though the lower layers can represent more job types.

## Testing Strategy

- No runtime changes in this task.
- Use code inspection and current Cloudflare docs as the verification source of truth.
- If a migration proceeds, test in this order:
  - unit test shared consumer logic
  - integration test producer payloads
  - stage long-delay scheduling behavior
  - verify ops/admin visibility decisions explicitly

## Rollout

- Step 1: split non-email Durable Objects into their own Worker or service boundary.
- Step 2: route short-delay email jobs to native Queue + consumer Worker.
- Step 3: add a scheduler/ledger for long-delay reminders.
- Step 4: retire gateway-specific email APIs and manual drain endpoints.

## DB Change Plan (if applicable)

- No schema changes in this audit.
- If queue visibility or long-delay scheduling must persist, add an explicit DB-backed email job ledger in a follow-up task.

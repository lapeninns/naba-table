---
task: fix-review-request-queue
timestamp_utc: 2026-03-25T06:44:27Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: medium
flags: [FEATURE_EMAIL_QUEUE_ENABLED]
related_tickets: []
---

# Implementation Plan: Fix Review Request Queue Visibility / Enqueue Investigation

## Objective

We will restore authoritative Cloudflare queue visibility for delayed email jobs so that we can confirm and support the canonical `review_request` scheduling flow for completed bookings such as `LPTZDB8DCA`.

## Success Criteria

- [ ] Cloudflare gateway detailed delayed jobs can be retrieved beyond the current 10-item ceiling.
- [ ] Old Crown Girton queue filtering reflects the full delayed job set.
- [ ] We can determine conclusively whether booking `LPTZDB8DCA` has a queued `review_request`.
- [ ] If a canonical enqueue bug remains after visibility is restored, it is fixed with regression coverage.

## Architecture & Components

- `cloudflare/email-queue-gateway/src/index.mjs`: authoritative queue status and drain worker.
- `scripts/cloudflare/deploy-email-gateway.sh`: production worker deploy path.
- `server/jobs/booking-side-effects.ts`: canonical review-request scheduler for completed bookings.
- `src/app/api/ops/email-queue/route.ts`: restaurant-filtered queue feed consumer.

## Data Flow & API Contracts

- Gateway status request:
  - `GET /status?includeJobs=1&jobLimit=all`
  - Expected response includes `queue.counts` and complete `queue.jobs.delayed`.
- Completion scheduling:
  - booking completion -> `enqueueCheckOutSideEffects` -> `scheduleReviewJob` -> `enqueueEmailJob` -> Cloudflare `/messages`

## UI/UX States

- No UI changes planned.

## Edge Cases

- Production worker may still be on an older rollback deployment despite newer source in the repo.
- Queue detail listing can be incomplete while summary counts remain correct.
- Review email may already be queued but hidden by the gateway detail bug.
- If absent after gateway repair, enqueue failures may currently be swallowed without durable observability.

## Testing Strategy

- Operational verification:
  - list current worker deployments
  - deploy current worker
  - query gateway `/status` and confirm delayed detail count matches summary
- Regression verification:
  - add/execute targeted tests if any source changes are needed after gateway verification

## Rollout

- Target: production Cloudflare worker only
- Monitoring:
  - direct gateway `/status`
  - production `email_delivery_log`
  - booking `LPTZDB8DCA`
- Kill-switch:
  - rollback via `pnpm run cloudflare:email-gateway:rollback`

## DB Change Plan (if applicable)

- No schema changes planned.

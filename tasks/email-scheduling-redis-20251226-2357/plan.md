---
task: email-scheduling-redis
timestamp_utc: 2025-12-26T23:57:10Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: [feat.email.queue]
related_tickets: []
---

# Implementation Plan: Redis-backed booking email scheduling

## Objective

We will enable queued delivery for all booking-related emails (pre-booking reminders, post-booking review requests, confirmations, updates, cancellations) so that emails are delivered reliably without relying on in-process delays.

## Success Criteria

- [ ] Email queue worker processes jobs and sends emails via Resend.
- [ ] All booking emails are queued when `FEATURE_EMAIL_QUEUE_ENABLED=true`.
- [ ] No secrets are stored in code; Redis config is environment-driven.

## Architecture & Components

- `server/queue/email.ts`: existing BullMQ queue + DLQ helpers.
- `scripts/queues/email-worker.ts`: new worker entry to process `pending-booking-email` jobs.
- `server/jobs/booking-side-effects.ts`: existing scheduling; expand to queue additional booking email types when flag is on.
- `scripts/queues/email-worker.ts`: new worker for long-lived process (confirmed available).

## Data Flow & API Contracts

Job payload: `{ bookingId, restaurantId, type, scheduledFor? }`

Worker flow:

1. Fetch booking by ID from Supabase.
2. Validate booking status and recipient email.
3. Apply type-specific guards (e.g., request_received only if still pending; reminders only if confirmed; review_request only if completed).
4. Dispatch appropriate email via `server/emails/bookings`.
5. Let BullMQ retry; move failed jobs to DLQ.

## UI/UX States

- N/A (no UI changes).

## Edge Cases

- Booking cancelled/updated after reminder scheduled; worker should verify status before sending.
- Missing booking or invalid email address; skip with warning.
- Redis unavailable; queue enabled should not break core booking flows (fallback to inline email already present).

## Testing Strategy

- Unit/integration: email worker handler logic and job type routing.
- Manual: enqueue test job, confirm email dispatch and retry behavior.

## Rollout

- Feature flag: `FEATURE_EMAIL_QUEUE_ENABLED` (env)
- Enable in staging first, then production (requested to turn on).
- Monitor queue DLQ and email sending logs.

## DB Change Plan (if applicable)

- Not applicable.

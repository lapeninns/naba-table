---
task: review-email-backfill
timestamp_utc: 2026-01-19T18:49:59Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Backfill review emails for past bookings

## Objective

We will send review-request emails for past bookings that were completed in reality but not marked completed in the system, up to the specified cutoff.

## Success Criteria

- [ ] Eligible bookings prior to the cutoff are transitioned to `completed` via standard lifecycle and review emails are scheduled.
- [ ] Cancelled/no-show/completed bookings are excluded.
- [ ] Dry-run artifact lists eligible booking IDs and counts before applying.
- [ ] Staging run limited to `amanshresthaaaaa@gmail.com` bookings only.
- [ ] Production run includes all guests (no email filter).

## Architecture & Components

- One-off script under `scripts/` using service Supabase client.
- Reuse booking lifecycle transitions and check-out side effects from server code.

## Data Flow & API Contracts

- Read bookings via Supabase: filter by status `confirmed`, booking end time < cutoff (per-restaurant local time) and < now. Email filter applies in staging only.
- Transition via `apply_booking_state_transition` RPC (same as check-out routes).
- Schedule review emails via `enqueueCheckOutSideEffects`.
- Update restaurant email prefs where `sendReviewRequest=false` (scope TBD).

## UI/UX States

- N/A (no UI changes).

## Edge Cases

- Missing `end_at`: fall back to `start_at` for check-out timestamp.
- Invalid/missing customer email: skip (side-effect guard).
- Restaurants with `sendReviewRequest` disabled: decide whether to skip or still mark completed (TBD).
- Per-restaurant timezone cutoff: convert local 2026-01-19 18:00 to UTC per restaurant.
- Missing `end_at`: derive end from `booking_date + end_time` in restaurant timezone; fallback to `start_at` if needed.

## Testing Strategy

- Dry-run execution with logging only.
- Apply on a small subset first (limit count) before full run.

## Rollout

- Feature flag: none.
- Run in staging first, then production after verification and approval.
- Monitoring: email queue logs + counts of updated bookings.
- Filter (staging only): `customer_email = amanshresthaaaaa@gmail.com`.

## DB Change Plan (if applicable)

- No migrations. Direct data updates only (remote Supabase).

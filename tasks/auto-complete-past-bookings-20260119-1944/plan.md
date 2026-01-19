---
task: auto-complete-past-bookings
timestamp_utc: 2026-01-19T19:44:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Auto-complete past bookings nightly

## Objective

Automatically complete past bookings and trigger review emails on a schedule so ops doesn’t miss manual check-out.

## Success Criteria

- [ ] Past `confirmed` and/or `checked_in` bookings are transitioned to `completed`.
- [ ] Review-request emails are scheduled/sent via existing side-effects.
- [ ] Cron job runs daily per restaurant local midnight with bounded batches and clear logging.

## Architecture & Components

- New cron endpoint: `/api/cron/auto-complete-bookings`.
- Shared helper in `server/jobs/` to find eligible bookings and apply transitions.
- Vercel cron schedule in `vercel.json` (hourly; local-midnight window = 60 minutes).

## Data Flow & API Contracts

- Query bookings by status and end time < now (per restaurant timezone) only within local-midnight window.
- For each booking:
  - If `confirmed`: apply check-in then check-out.
  - If `checked_in`: apply check-out only.
- Call `enqueueCheckOutSideEffects` after completion.

## UI/UX States

- N/A.

## Edge Cases

- Missing `end_at`: derive from `booking_date + end_time` in restaurant timezone; fallback to `start_at`.
- Invalid email: skip (email guard).
- Already completed/no_show/cancelled: skip.
- Missing actor ID: resolve from restaurant membership → auth user fallback; optional env override.

## Testing Strategy

- Dry-run mode for cron (no writes).
- Unit tests for eligibility filter and timezone window.
- Staging cron run with small batch.

## Rollout

- Schedule to run hourly with a midnight-local window (daily behavior per restaurant).
- Monitor email queue and logs.
- Feature flag (optional) to disable automation.

## DB Change Plan (if applicable)

- N/A.

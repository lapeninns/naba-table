---
task: sms-delivery-observability
timestamp_utc: 2026-04-13T12:49:00Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Inspect current SMS send path and existing email delivery pattern.
- [x] Create task-local notes and continuity update.

## Core

- [x] Add migration + generated type updates for `sms_delivery_log`.
- [x] Add shared SMS delivery server helpers.
- [x] Record outbound SMS send attempts.
- [x] Add Twilio status callback webhook with signature validation.
- [x] Add booking-level ops API for SMS delivery events.

## UI/UX

- [x] Add booking details SMS delivery panel.
- [x] Verify empty / unavailable / error / populated states.

## Tests

- [x] Unit
- [x] Integration
- [x] UI

## Notes

- Assumptions:
  - First pass prioritizes booking-level visibility over a full restaurant-wide SMS dashboard.
  - SMS retry is intentionally excluded to avoid accidental duplicate guest texts.
- Deviations:
  - The dev harness initially used a booking id that did not exist in the mock booking service fixtures, so browser proof first surfaced the SMS panel error state; the harness was then corrected to use the canonical fixture booking id before final UI verification.
  - Supabase CLI Postgres auth remained unusable from this machine, so the staging and production migration was applied through the Supabase Management API and recorded in `supabase_migrations.schema_migrations` to preserve migration history.

## Batched Questions

- None currently.

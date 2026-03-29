---
task: move-old-school-house-bookings-to-old-crown
timestamp_utc: 2026-03-29T07:20:00Z
owner: github:@openai
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm active remote Supabase credentials are available in this workspace.
- [x] Resolve exact source and destination restaurant IDs.
- [x] Capture preflight counts and impacted booking IDs.

## Core

- [x] Inspect dependent booking-linked tables for restaurant-scoped data risks.
- [x] Execute the booking move in remote Supabase.
- [x] Capture affected-row count from the update.

## UI/UX

- [ ] Not applicable.

## Tests

- [x] Preflight query verification
- [x] Postflight query verification

## Notes

- Assumptions:
  - User intended every Old School House booking row in production.
- Deviations:
  - Used the production service-role Supabase HTTP path because direct Postgres auth from `.env.vercel-production` failed.

## Batched Questions

- None. Preflight showed only one Old School House booking in production, so the full requested scope was moved.

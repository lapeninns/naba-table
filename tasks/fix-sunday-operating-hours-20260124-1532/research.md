---
task: fix-sunday-operating-hours
timestamp_utc: 2026-01-24T15:32:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Fix Sunday Operating Hours

## Requirements

- Functional:
  - Sunday lunch bookings should be allowed when operating hours are configured for Sunday.
  - Booking RPC should correctly map day-of-week to stored operating hours.
- Non-functional (a11y, perf, security, privacy, i18n):
  - No UI changes; no a11y impact.
  - Preserve performance in booking RPC.
  - No new data exposure.

## Existing Patterns & Reuse

- Operating hours stored in `restaurant_operating_hours` with `day_of_week` 0–6 (Sunday=0) in server code.
- RPC `create_booking_with_capacity_check` validates hours in DB.

## External Resources

- N/A

## Constraints & Risks

- Supabase is remote-only; any DB migration must follow staging-first and rollback plan.
- Must keep changes focused; avoid unrelated refactors.

## Open Questions (owner, due)

- Q: Should we also add a server-side guard to detect mismatch? (owner: github:@amanshresthaa)

## Recommended Direction (with rationale)

- Align RPC day-of-week to 0–6 (use `EXTRACT(DOW)` or normalize ISODOW) so DB validation matches stored operating hours. This is the minimal, consistent fix.

---
task: add-bookings
timestamp_utc: 2026-01-24T20:33:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Add 45 bookings for tomorrow

## Requirements

- Functional: Insert 45 bookings for 2026-01-25 (tomorrow) across the full day.
- Non-functional: Use Supabase remote only; avoid PII; keep data clearly labeled as test.

## Existing Patterns & Reuse

- Bookings live in `public.bookings` with restaurant_id FK.

## External Resources

- None.

## Constraints & Risks

- Must target pre-staging project `loxrwkeuxesctnrdpksy`.
- Need required columns to satisfy NOT NULL constraints.

## Open Questions (owner, due)

- Which restaurant? (Assume Old Crown Girton unless specified otherwise.)

## Recommended Direction (with rationale)

- Inspect schema, then insert via SQL with generated times and labeled test names.

---
task: per-day-reservation-intervals
timestamp_utc: 2026-02-03T17:49:04Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Per-Day Reservation Interval Overrides

## Requirements

- Functional:
  - Allow per-day reservation interval overrides (weekly + specific date) in Operating Hours.
  - Allow fixed slot times (weekly + specific date) that override interval when set.
  - Effective interval resolves as: override → weekly → restaurant default → 15.
  - Schedule API and Ops timeline use fixed slots when set; otherwise use effective interval.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Accessibility for new inputs (labels, focus, errors).
  - No additional data leaks; validate inputs at API boundary.

## Existing Patterns & Reuse

- Operating hours stored in `restaurant_operating_hours` with weekly and date overrides.
- Schedule calculation in `server/restaurants/schedule.ts` uses restaurant-level `reservation_interval_minutes`.
- Ops settings UI already edits operating hours and uses Shadcn inputs.

## External Resources

- None.

## Constraints & Risks

- Supabase remote-only migrations with staging-first requirement.
- UI changes require Chrome DevTools MCP QA artifacts.

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- Add nullable interval column to operating hours and surface in Ops UI; compute effective interval in schedule and timeline.

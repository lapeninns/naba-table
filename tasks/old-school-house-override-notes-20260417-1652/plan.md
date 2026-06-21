---
task: old-school-house-override-notes
timestamp_utc: 2026-04-17T16:52:21Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Old School House Override Notes

## Objective

We will move the drinks-only note off the weekly operating-hours rows for The Old School House and onto temporary date overrides for the requested date span so the note remains temporary and time-bounded.

## Success Criteria

- [x] All seven weekly operating-hours rows for `the-old-school-house` have `notes = null`.
- [x] The confirmed temporary override dates carry the drinks-only note.
- [x] Override rows keep the same hours and closed/open status as the current weekly schedule for each date.
- [x] Before/after proof is saved in task artifacts.

## Architecture & Components

- Production remote `restaurants` row:
  - `id = a120da71-ba6d-446f-a33a-2e78787abcb0`
  - `slug = the-old-school-house`
- `restaurant_operating_hours`:
  - weekly rows will keep their current times and clear `notes`
  - date override rows will mirror the matching weekday times and carry the temporary note

## Data Flow & API Contracts

- Read current weekly/override rows from production.
- Build a full replacement payload that:
  - preserves weekly times / closure state / interval / slot-time fields
  - preserves non-target existing overrides if any appear between read and write
  - adds or replaces only the confirmed target-date overrides
- Apply the update through the canonical operating-hours shape.

## Edge Cases

- If an existing override already exists for a target date, update that date rather than duplicating it.
- The confirmed override window is `2026-04-17` through `2026-04-23` inclusive.
- Friday `2026-04-24` must not carry the temporary note because food resumes that day.

## Testing Strategy

- Production read-before / read-after snapshot comparison.
- No UI/browser verification required because this is a data-only change with no code edits.

## Rollout

- Apply directly to the production remote after date-span confirmation.
- Rollback: restore the captured before-state payload through the same full replacement path.

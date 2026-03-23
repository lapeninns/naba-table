---
task: old-crown-weekend-slot-alignment
timestamp_utc: 2026-03-23T12:33:00Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: medium
flags: []
related_tickets: []
---

# Research: Old Crown Weekend Slot Alignment

## Requirements

- Functional:
  - Update The Old Crown Girton to use a 30-minute reservation interval.
  - Ensure Saturday and Sunday lunch slots reflect the configured `12:00-17:00` lunch service period instead of stopping at `15:15`.
  - Preserve Friday lunch ending at `15:00` and weekend dinner starting at `17:00`.
- Non-functional (a11y, perf, security, privacy, i18n):
  - No UI changes in this task.
  - Remote-only data change; keep secrets out of source and artifacts.

## Existing Patterns & Reuse

- Schedule generation lives in `server/restaurants/schedule.ts`.
- Occasion availability parsing lives in `reserve/shared/occasions/index.ts`.
- Occasion catalog loading lives in `server/occasions/catalog.ts`.
- Old Crown live service periods already declare:
  - Friday lunch: `12:00-15:00`
  - Saturday lunch: `12:00-17:00`
  - Sunday lunch: `12:00-17:00`

## External Resources

- None.

## Constraints & Risks

- The shared `booking_occasions` record for `lunch` currently caps lunch at `15:30`, which overrides multiple restaurant service periods that extend to `17:00`.
- Changing the shared lunch availability affects all restaurants using the `lunch` occasion, so verification must confirm that service-period coverage still constrains weekdays correctly.
- Old Crown currently has:
  - `reservation_interval_minutes = 15`
  - `reservation_default_duration_minutes = 90`
  - `reservation_last_seating_buffer_minutes = 30`

## Open Questions (owner, due)

- Q: Should late lunch seating be limited by service-period end plus duration/buffer rather than by restaurant closing time?
  A: Out of scope for this live alignment pass; current behavior only uses restaurant closing time in schedule generation.

## Recommended Direction (with rationale)

- Update Old Crown's live `reservation_interval_minutes` from `15` to `30`.
- Update the shared `lunch` occasion availability window from `11:30-15:30` to `11:30-17:00` so it matches the existing weekend lunch service-period pattern already configured for multiple restaurants.
- Add a canonical migration recording the `lunch` occasion update so future environments remain aligned with production.

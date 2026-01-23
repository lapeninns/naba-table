---
task: disable-weekday-gap
timestamp_utc: 2026-01-23T00:55:24Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Lunch/Dinner Only (Remove Drinks & Cocktails)

## Requirements

- Functional:
  - Remove “Drinks & Cocktails” as a booking occasion (no booking type, no slots).
  - Only lunch and dinner occasions are bookable.
  - Slots are offered only within their configured service periods (no mid‑afternoon weekday gap).
- Non-functional (a11y, perf, security, privacy, i18n):
  - No regressions in schedule API performance.
  - UI remains accessible; slot list updates should not break keyboard selection.

## Existing Patterns & Reuse

- Slot generation is centralized in `server/restaurants/schedule.ts`.
- Service periods are stored in `restaurant_service_periods` and validated in `server/restaurants/servicePeriods.ts`.
- Occasion catalog is loaded from `booking_occasions` and already filtered to lunch/dinner for schedule output.

## External Resources

- None required.

## Constraints & Risks

- Schedule currently creates slots across operating hours and may enable slots even without service period coverage.
- Removing “Drinks & Cocktails” may require a Supabase data change (remote‑only) if it exists in `booking_occasions`.
- If a restaurant has no lunch/dinner service periods configured, enforcing “service period only” could yield zero slots.

## Open Questions (owner, due)

- Q: Should we delete/deactivate “Drinks & Cocktails” in the DB (ops occasion list), or just prevent it from being used in booking flows?
  A: UNCONFIRMED (owner: github:@amanshresthaa, due: 2026-01-23)
- Q: If a restaurant has no lunch/dinner service periods configured, should we show no slots or fall back to operating hours?
  A: UNCONFIRMED (owner: github:@amanshresthaa, due: 2026-01-23)

## Recommended Direction (with rationale)

- Filter schedule slots to only those within lunch/dinner service periods and remove any fallback enabling outside coverage.
- If “Drinks & Cocktails” exists in the catalog, deactivate or delete it via Supabase (staging → prod), so it cannot be selected anywhere.

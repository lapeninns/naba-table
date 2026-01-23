---
task: disable-weekday-gap
timestamp_utc: 2026-01-23T00:55:24Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Lunch/Dinner Only (Remove Drinks & Cocktails)

## Objective

We will ensure only lunch and dinner bookings are possible, and only within their service periods (no weekday 15:00–17:00 gap slots).

## Success Criteria

- [ ] “Drinks & Cocktails” is deleted from `booking_occasions` and cannot be selected.
- [ ] Weekday 15:00–17:00 slots are not returned unless covered by lunch/dinner service periods.
- [ ] Schedule returns lunch/dinner slots only when they fall within configured service periods; if no lunch/dinner periods exist, return zero slots.

## Architecture & Components

- `server/restaurants/schedule.ts`: enforce service‑period coverage when generating slots (no fallback outside periods).
- `server/restaurants/servicePeriods.ts`: keep booking options limited to lunch/dinner.
- Supabase `booking_occasions`: delete “Drinks & Cocktails”.

## Data Flow & API Contracts

- Endpoint: `GET /restaurants/:slug/schedule` (no contract changes).
- Response: `slots` only inside lunch/dinner service periods; no drinks-only slots.

## UI/UX States

- Loading / Empty / Error / Success unchanged; weekday mid‑afternoon slots will be absent.

## Edge Cases

- If `weekdayLunchEnd >= dinnerStart`, do not apply a gap; rely purely on service periods.
- If no lunch/dinner service periods exist, return zero slots.

## Testing Strategy

- Manual QA (Chrome DevTools MCP):
  - Weekday: ensure no 15:00–17:00 slots.
  - Weekend: ensure expected lunch/dinner coverage.
  - Verify no “Drinks & Cocktails” appears anywhere in booking flow.

## Rollout

- No feature flag requested; change applies globally after confirmation.

## DB Change Plan (if applicable)

- Target envs: staging → production.
- Precondition: resolve existing `bookings.booking_type = 'drinks'` (reassign or cancel) to satisfy FK.
- Operation: delete “Drinks & Cocktails” from `booking_occasions` (Supabase MCP).
- Dry‑run evidence: `artifacts/db-diff.txt` (capture select + delete candidate count).
- Rollback plan: reinsert deleted row from backup/export if needed.

---
task: fix-edit-period-slots
timestamp_utc: 2026-01-23T08:18:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Prevent Out-of-Period Edit Slots

## Objective

We will ensure dashboard edit time selection only surfaces slots inside lunch/dinner service periods so that ops edits cannot bypass the lunch/dinner-only restriction.

## Success Criteria

- [ ] Edit time picker does not offer out-of-period times (e.g., 15:00–17:00 gaps).
- [ ] Existing schedule availability behavior remains unchanged for in-period slots.

## Architecture & Components

- `ScheduleAwareTimestampPicker`:
  - Adjust `mergeWithSyntheticSlots` to avoid treating synthetic slots as available.
- `server/restaurants/schedule.ts`:
  - Align `buildCoverage` validation with `periodDetails` for consistency.
  - Remove `buildAvailability` fallback that re-enables disabled services.

## Data Flow & API Contracts

- No API contract changes; edit flow continues to call `/restaurants/:slug/schedule`.

## UI/UX States

- Suggestions list only includes in-period slots.
- If no slots exist, existing warning behavior remains unchanged.

## Edge Cases

- Existing bookings outside a service period may not appear in the suggestion list.
- Restaurants with invalid service period ranges should not produce coverage entries.

## Testing Strategy

- Unit: If existing tests cover schedule slot availability, extend them; otherwise verify manually.
- Manual QA (required): Dashboard edit flow; ensure out-of-period times are absent.

## Rollout

- Feature flag: none.
- Monitoring: standard error logs; no new telemetry.
- Kill-switch: revert change if edit flow is blocked unexpectedly.

## DB Change Plan (if applicable)

- Not applicable.

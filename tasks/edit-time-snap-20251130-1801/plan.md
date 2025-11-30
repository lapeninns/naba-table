---
task: edit-time-snap
timestamp_utc: 2025-11-30T18:01:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Snap edit time input to 15-minute steps

## Objective

Ensure manually entered times in the edit booking dialog snap to the schedule interval (15-minute steps by default), matching the create flow and reducing “Selected time is no longer available” errors.

## Success Criteria

- [ ] Manual entry in edit time input snaps to nearest 15-minute boundary.
- [ ] Availability validation still rejects genuinely unavailable slots.
- [ ] Build passes.

## Architecture & Components

- Update `ScheduleAwareTimestampPicker` to round committed time inputs to the active `intervalMinutes` (default 15) before availability checks and state updates.

## Data Flow & API Contracts

- Unchanged; continues to use schedule-derived slots and Supabase-backed availability.

## UI/UX States

- Input value should reflect snapped time; error messaging remains for unavailable slots.

## Edge Cases

- Handling times near hour boundaries (e.g., 12:53 → 13:00).
- Interval missing: fall back to default 15 minutes.

## Testing Strategy

- Run `pnpm run build`.
- Spot-check manual entry in edit dialog (DevTools MCP) to confirm snapping and absence of spurious availability errors.

## Rollout

- No flags; direct release.

## DB Change Plan (if applicable)

- None.

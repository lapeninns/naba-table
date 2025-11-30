---
task: edit-calendar-fetch
timestamp_utc: 2025-11-30T16:34:57Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Edit booking calendar fetch

## Requirements

- Functional: Align the edit booking dialog calendar so it doesn’t fetch availability one day at a time; reuse the same month-level availability approach used by the create (booking wizard) calendar. Preserve ability to pick a start time, party size, and submit edits without regression.
- Non-functional: Reduce network chatter and latency while keeping existing a11y (keyboard/focus) and validation behavior intact. Avoid changing API contracts.

## Existing Patterns & Reuse

- Edit dialog uses `ScheduleAwareTimestampPicker` (`components/features/booking-state-machine`), which currently prefetches every date in a month via `loadSchedule` + `prefetchMonth`, driving `Calendar24Date` with per-day schedule data.
- Create/booking flow (`reserve/features/reservations/wizard`) uses month-level calendar masks via `fetchCalendarMask`/`calendarMaskQueryKey` (see `usePlanStepForm`) and only fetches a schedule when a specific date is selected. `Calendar24Date` supports `loadingDates` and `isDateUnavailable` fed by that mask.
- Availability helpers live in `@reserve/shared/schedule/availability` and `schedule.ts` already exports both schedule and mask fetchers.

## External Resources

- None needed; all patterns and APIs live in the repo.

## Constraints & Risks

- Must not block date selection when mask data is missing; unknown dates should remain selectable and load on demand.
- Need to preserve current time-slot selection and error messaging (`closed`, `no-slots`, `unknown`).
- Network reduction should not remove necessary caching; React Query keys must stay consistent.

## Open Questions

- None outstanding; will mirror the create flow’s mask-first approach and keep per-date schedule fetch only for the active day.

## Recommended Direction (with rationale)

- Replace month-wide per-day schedule prefetch in `ScheduleAwareTimestampPicker` with calendar-mask prefetch (same month batching as create flow). Use the mask to mark closed dates and defer schedule fetching to the active date (and optional near-date prefetch) only. Update disabled-date logic to treat “no data yet” as selectable, matching the create calendar UX while cutting request volume.

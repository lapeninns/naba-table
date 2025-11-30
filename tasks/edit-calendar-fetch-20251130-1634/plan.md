---
task: edit-calendar-fetch
timestamp_utc: 2025-11-30T16:34:57Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Edit booking calendar fetch

## Objective

Make the edit booking dialog’s calendar fetch availability in the same month-batched way as the create flow, eliminating one-by-one day fetches while keeping edit functionality and UX unchanged.

## Success Criteria

- Calendar mask is fetched per month (or month cluster) instead of issuing schedule requests for every day in the month.
- Selecting dates/times in the edit dialog still works and shows closed/no-slot messaging correctly.
- Closed dates remain disabled; open dates stay selectable without unexpected “unknown” blocking.

## Architecture & Components

- Touch `src/components/features/booking-state-machine/ScheduleAwareTimestampPicker.tsx`.
- Introduce calendar-mask prefetch using existing `fetchCalendarMask`/`calendarMaskQueryKey` and reuse `formatDateForInput` + month-key helpers.
- Track unavailable dates via a map (closed/no-slots/unknown) derived from mask + the active date’s schedule; avoid month-wide schedule prefetch.
- Update `Calendar24Date` props (`isDateUnavailable`, `loadingDates`) to leverage the new mask-driven map.

## Data Flow & API Contracts

- New mask fetch: `GET /restaurants/:slug/calendar-mask?from=YYYY-MM-DD&to=YYYY-MM-DD` via `fetchCalendarMask`.
- Schedule fetch remains per active date via `fetchReservationSchedule` (unchanged key).
- State updates ensure unknown dates are not disabled until data is known.

## UI/UX States

- Loading: show date loading dots via `loadingDates` while a month mask is in flight; keep existing time loading state for schedule fetch.
- Closed: disable closed dates using mask results; surface closed copy in the time panel.
- No slots: handled after the active date schedule loads; keep existing messaging.
- Error: if mask fetch fails, fall back to selectable dates with time fetch on demand.

## Edge Cases

- Missing `restaurantSlug` or timezone: keep existing fallback behavior and avoid mask/schedule fetch.
- Min date normalization so mask generation respects `minDate`.
- Avoid duplicate mask fetches for already prefetched months.

## Testing Strategy

- Manual QA (Chrome DevTools MCP): open edit booking dialog, switch months, confirm only mask + active-day schedule requests, closed dates disabled, times load and save CTA enabled when valid.
- Automated: run `pnpm lint` (feasibility permitting) and rely on TypeScript build to catch errors; no existing unit tests for this component.

## Rollout

- No feature flag; change is targeted. Monitor booking edit flow; rollback by reverting component if needed.

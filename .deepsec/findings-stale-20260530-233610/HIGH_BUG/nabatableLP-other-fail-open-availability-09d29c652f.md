# [HIGH_BUG] Timeline fails open when booking or hold loads fail

**File:** [`server/ops/table-timeline.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/server/ops/table-timeline.ts#L206-L462) (lines 206, 208, 277, 281, 457, 462)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-fail-open-availability`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The scanner's crypto hits are false positives, but the timeline has a serious fail-open data integrity bug. `loadTimelineBookings` logs any Supabase error and returns an empty array, and `loadHolds` catches hold-loading errors and also returns an empty array. `getTableAvailabilityTimeline` then builds the busy map from those empty datasets; for a table with no busy windows, `buildSegmentsFromBusyWindows` emits a full-window `available` segment. The shipped timeline and operations-hub routes do perform restaurant membership checks before calling this helper, so this is not an auth bypass, but a transient DB/RLS/schema failure can produce a 200 response showing reserved or held tables as available, which can lead to double seating or overbooking.

## Recommendation

Fail closed for booking and hold load failures that affect occupancy. Propagate the error from `loadTimelineBookings` and `loadHolds` so the route returns a 5xx or an explicit degraded response that the UI cannot interpret as availability. If optional holds compatibility is required, only suppress known missing-feature errors behind an explicit feature flag and surface a degraded-state marker in the response.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-03-23)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-12)

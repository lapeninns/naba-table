# [HIGH_BUG] Timeline can fail open and show occupied tables as available

**File:** [`src/app/api/ops/tables/timeline/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/src/app/api/ops/tables/timeline/route.ts#L63) (lines 63)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-fail-open-availability`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The route authorizes the user correctly before calling getTableAvailabilityTimeline, but the downstream timeline builder catches booking-load and hold-load failures and returns empty arrays. That means a Supabase/RLS/transient error while loading bookings or active holds can still produce a 200 response where reserved or held tables are rendered as available. This can cause serious operational errors such as double seating or overbooking because the API fails open on the data that defines occupancy.

## Recommendation

Fail closed when booking or hold loading fails. Return a 5xx from the timeline endpoint, or include an explicit degraded/error state that the UI cannot treat as real availability.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-12)

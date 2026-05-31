# [BUG] Stale calendar-mask requests can update availability after the restaurant changes

**File:** [`reserve/features/reservations/wizard/hooks/usePlanStepForm.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/reserve/features/reservations/wizard/hooks/usePlanStepForm.ts#L272-L372) (lines 272, 289, 295, 372)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** medium • **Slug:** `other-stale-async-state`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

prefetchCalendarMask captures the current restaurant slug and asynchronously fetches a calendar mask, then applies the mask to component state when the promise resolves. When restaurantSlug changes, the hook clears unavailableDates and overrideDates, but it does not cancel in-flight fetchQuery calls or verify that the resolved mask still belongs to the current restaurant before calling applyCalendarMask. A slow response from the previous restaurant can therefore mark dates closed/open for the newly selected restaurant and can affect later auto-advance and blocking logic.

## Recommendation

Track the active restaurant slug/generation in a ref and ignore resolved masks whose slug no longer matches, and/or cancel old calendar-mask queries on restaurantSlug change before clearing state.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-19)

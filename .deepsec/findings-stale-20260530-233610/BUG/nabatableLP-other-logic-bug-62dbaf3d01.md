# [BUG] Overnight operating hours are rejected despite database support

**File:** [`server/restaurants/operatingHours.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/server/restaurants/operatingHours.ts#L84-L229) (lines 84, 89, 183, 229)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-logic-bug`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

ensureOpenBeforeClose rejects any open interval where opensAt is greater than or equal to closesAt, and both weekly entries and overrides call it. The database migration 20260515180000_allow_overnight_operating_hours explicitly allows close times after midnight as long as opens_at and closes_at are not equal. Valid schedules such as 18:00-01:00 or 12:00-00:00 therefore cannot be saved through this helper or the APIs that call it.

## Recommendation

Change the helper to reject only equal open and close times, then add tests for overnight weekly hours and date overrides.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-19)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-03)

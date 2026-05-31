# [HIGH_BUG] Concurrent full replacements can erase operating hours

**File:** [`server/restaurants/operatingHours.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/server/restaurants/operatingHours.ts#L379-L410) (lines 379, 381, 392, 406, 407, 410)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-race-condition`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

updateOperatingHours builds a full replacement set, assigns fresh UUIDs to weekly rows on every call, then sends the entire set to replace_restaurant_operating_hours. The referenced RPC inserts/upserts the incoming rows and deletes any existing rows not present in the current call, but the migration defining that RPC does not take a per-restaurant advisory lock. Two concurrent saves or sync jobs for the same restaurant can interleave so that request A deletes request B's newly inserted rows and request B then deletes request A's rows, leaving the restaurant with an empty or stale schedule. This helper is used by ops/admin saves, onboarding hours, and GBP sync paths.

## Recommendation

Serialize replacements per restaurant inside the database function, for example with pg_advisory_xact_lock on the restaurant id before insert/delete work. Add a concurrent replacement regression test and consider preserving stable weekly row ids.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-19)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-03)

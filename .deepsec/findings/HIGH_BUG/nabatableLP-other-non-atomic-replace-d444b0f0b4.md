# [HIGH_BUG] Operating-hours import can delete the full schedule before a failed insert

**File:** [`server/dual-sync/publish/ports/operating-hours-import.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/dual-sync/publish/ports/operating-hours-import.ts#L153-L155) (lines 153, 155)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-non-atomic-replace`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The import port rebuilds the full weekly schedule plus overrides and calls updateOperatingHours. The traced writer deletes every restaurant_operating_hours row for the restaurant before inserting the rebuilt rows, without a transaction. A DB/constraint/network failure after the delete leaves the restaurant without operating hours; concurrent publish jobs can also overwrite each other’s changes.

## Recommendation

Replace the schedule inside a database transaction/RPC, or upsert the targeted weekly row instead of replacing the whole table. Use a per-restaurant lock for publish writes.

## Revalidation

**Verdict:** fixed

The dual-sync operating-hours import port still delegates persistence to `updateOperatingHours`, but that shared writer now calls the service-role-only `replace_restaurant_operating_hours` RPC instead of issuing separate table deletes and inserts. The helper validates duplicate override ids/dates before mutation, and the RPC performs the schedule replacement atomically. Focused evidence: `pnpm exec vitest run tests/server/restaurants/atomic-replacements.test.ts tests/server/restaurant-business-context.test.ts tests/server/restaurant-business-context-routes.test.ts tests/server/restaurant-schedule-replacements.test.ts` passed on 2026-05-16.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-30)

# [HIGH_BUG] Operating-hours replacement can leave a restaurant with no schedule on insert failure

**File:** [`server/restaurants/operatingHours.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/restaurants/operatingHours.ts#L349-L389) (lines 349, 378, 389)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-non-atomic-replace`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

updateOperatingHours validates the payload, deletes every operating-hours row for the restaurant, and then inserts the replacement rows. If insert fails after deletion, for example because duplicate override ids or invalid dates pass local validation but fail database constraints/casts, the restaurant schedule is wiped and the function returns an error.

## Recommendation

Replace the delete+insert sequence with an atomic database transaction/RPC. Validate actual calendar dates and duplicate override ids before deleting existing rows.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-18)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-03)

**Verdict:** fixed

`updateOperatingHours` now validates real override dates plus duplicate override ids/dates before mutation, then calls the service-role-only `replace_restaurant_operating_hours` RPC. The RPC performs replacement inside one database transaction by upserting incoming rows and deleting obsolete rows atomically, so an insert/update failure rolls back without leaving the restaurant with no schedule.

Evidence: `pnpm exec vitest run tests/server/restaurant-schedule-replacements.test.ts` passed on 2026-05-16. The regression coverage verifies the helper uses the atomic replacement RPC rather than delete-then-insert and rejects duplicate override ids before replacement.

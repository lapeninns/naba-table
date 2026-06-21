# [HIGH_BUG] Service-period replacement can delete all periods on insert failure

**File:** [`src/app/api/ops/restaurants/[id]/service-periods/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/[id]/service-periods/route.ts#L178-L215) (lines 178, 215)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-non-atomic-replace`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

PUT calls updateServicePeriods, and the GBP sync path can also reach the same helper. That helper validates, deletes every restaurant_service_periods row for the restaurant, then inserts the replacement rows as a separate statement. A payload with duplicate UUID ids passes this route's schema but causes the insert to fail after the delete, leaving the restaurant with no service periods. Other database insert failures would have the same data-loss effect.

## Recommendation

Perform the delete and insert in one database transaction/RPC, validate duplicate ids before mutation, and roll back the delete if any replacement row fails.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-18)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-19)

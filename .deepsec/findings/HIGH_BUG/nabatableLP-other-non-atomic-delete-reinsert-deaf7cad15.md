# [HIGH_BUG] Service period updates can lose data on partial failure or cascades

**File:** [`server/restaurants/servicePeriods.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/restaurants/servicePeriods.ts#L167-L195) (lines 167, 170, 176, 187, 189, 195)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-non-atomic-delete-reinsert`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

`updateServicePeriods` deletes every `restaurant_service_periods` row for the restaurant and then inserts the replacement rows outside a transaction. If the insert fails after the delete, the restaurant is left with no service periods. The delete can also cascade or null out dependent rows such as capacity rules linked by `service_period_id`, so even a successful reinsertion with the same IDs can destroy associated capacity configuration. Concurrent updates also have last-writer-wins behavior with no conflict detection.

## Recommendation

Move the replacement into a single database transaction/RPC, or implement a diff-based upsert/delete strategy that preserves existing rows and dependent records. Add optimistic concurrency checks or versioning for concurrent edits and make failures roll back all changes.

## Revalidation

**Verdict:** true-positive

updateServicePeriods still validates the new array, deletes every restaurant_service_periods row for the restaurant, and then inserts the replacement rows in a separate statement. There is no transaction or rollback if the insert fails after the delete. The route and helper do not reject duplicate supplied period ids, so a payload with the same UUID twice can pass local validation and fail on insert after existing rows are gone. The capacity rules migrations show service_period_id depends on restaurant_service_periods and may cascade or lose the association when service periods are deleted. Even a successful delete/reinsert can therefore destroy dependent capacity configuration before rows with the same ids are recreated. Concurrent writers also have no version check, so this is a real data-loss bug.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-18)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-23)

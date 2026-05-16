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

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-18)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-23)

**Verdict:** fixed

`updateServicePeriods` now rejects duplicate service-period ids before mutation and uses `replace_restaurant_service_periods` for the replacement. The service-role-only RPC performs upsert-first replacement inside a database transaction and only deletes rows omitted from the replacement set after incoming rows are valid, preserving dependent capacity configuration for unchanged ids and rolling back on failure.

Evidence: `pnpm exec vitest run tests/server/restaurant-schedule-replacements.test.ts` passed on 2026-05-16. The regression coverage verifies direct delete-then-insert chains are not used and duplicate supplied period ids are rejected before the RPC call.

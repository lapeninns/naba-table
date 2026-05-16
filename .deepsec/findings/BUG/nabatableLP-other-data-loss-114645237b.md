# [BUG] Partial table updates can unintentionally clear notes and position

**File:** [`src/services/ops/tables.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/services/ops/tables.ts#L274-L293) (lines 274, 280, 292, 293)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-data-loss`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

`update()` accepts a partial payload, but it serializes omitted `position` and `notes` fields as `null`. Any caller that updates only one table field through this service will send `position: null` and `notes: null`, causing the server to clear existing floor-plan coordinates and notes.

## Recommendation

Build the PATCH body by adding only properties whose payload keys are not `undefined`; preserve explicit `null` only when the caller intentionally supplies it.

## Revalidation

**Verdict:** fixed

`src/services/ops/tables.ts` now builds PATCH bodies from defined keys only. Omitted partial-update fields are not serialized, while explicit `null` values for `position` and `notes` still pass through when an operator intentionally clears them.

Evidence: `pnpm exec vitest run tests/server/ops-bookings-list-route.test.ts tests/server/ops-booking-table-assignment-route.test.ts tests/services/ops-tables-service.test.ts` passed on 2026-05-16. `pnpm exec prettier --check src/app/api/ops/bookings/route.ts 'src/app/api/ops/bookings/[id]/tables/route.ts' src/services/ops/tables.ts tests/server/ops-booking-table-assignment-route.test.ts tests/server/ops-bookings-list-route.test.ts tests/services/ops-tables-service.test.ts` also passed.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-29)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-12)

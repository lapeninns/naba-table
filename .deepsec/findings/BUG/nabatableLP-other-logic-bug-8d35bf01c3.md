# [BUG] tableId filter does not constrain parent booking rows

**File:** [`src/app/api/ops/bookings/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/bookings/route.ts#L560-L577) (lines 560, 563, 576, 577)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** medium • **Slug:** `other-logic-bug`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The GET query selects booking_table_assignments as an embedded relation without !inner, then applies .eq('booking_table_assignments.table_id', params.tableId). In PostgREST/Supabase, filtering an embedded left-join relation filters the embedded array, not the parent bookings, unless the relation is selected with !inner. As a result, requesting a specific table can still return unrelated bookings for the restaurant, with empty or partial assignment data.

## Recommendation

Use an inner embedded join for the filtered relation, for example booking_table_assignments!inner(...), or first resolve matching booking IDs from assignments and filter bookings by those IDs.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-03-23)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-06)

**Verdict:** fixed

`src/app/api/ops/bookings/route.ts` now selects `booking_table_assignments!inner(...)` when `tableId` is present, so the embedded assignment filter constrains parent booking rows. Unfiltered list requests keep the regular embedded relation.

Evidence: `pnpm exec vitest run tests/server/ops-bookings-list-route.test.ts tests/server/ops-booking-table-assignment-route.test.ts tests/services/ops-tables-service.test.ts` passed on 2026-05-16. `pnpm exec prettier --check src/app/api/ops/bookings/route.ts 'src/app/api/ops/bookings/[id]/tables/route.ts' src/services/ops/tables.ts tests/server/ops-booking-table-assignment-route.test.ts tests/server/ops-bookings-list-route.test.ts tests/services/ops-tables-service.test.ts` also passed.

---
task: customers-db-pagination
timestamp_utc: 2026-03-29T18:49:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Implementation Plan: Customers DB Pagination Follow-up

## Objective

We will move the paginated ops customers list and summary back into the database so the page keeps live booking truth without fetching and recomputing the full guest-history dataset on every request.

## Success Criteria

- [ ] `/api/ops/customers` no longer fetches all customers and bookings for each page request.
- [ ] Sorting/filtering/pagination for guest history happens in SQL/RPC.
- [ ] Summary metrics come from the same filtered SQL aggregate set.
- [ ] Export remains aligned with the same semantics, even if it pages through the RPC in batches.
- [ ] Client DTOs and UI behavior remain unchanged.

## Architecture

### New DB-backed contracts

1. `public.ops_customers_history_feed(...)`
   - returns paged guest-history rows with page-size + 1 behavior
   - applies search, marketing filter, min bookings, last visit filter, and sort in SQL

2. `public.ops_customers_history_summary(...)`
   - returns summary counters over the same filtered aggregate set

### Server wiring

- [`server/ops/customers.ts`](/Users/amankumarshrestha/.codex/worktrees/1d2c/nabatableLP/server/ops/customers.ts)
  - normalize params
  - call feed RPC
  - map rows into the existing `CustomerGuestRecord`
  - call summary RPC only when requested
  - page through feed RPC for export

- [`src/app/api/ops/customers/route.ts`](/Users/amankumarshrestha/.codex/worktrees/1d2c/nabatableLP/src/app/api/ops/customers/route.ts)
  - keep route contract stable

- [`src/app/api/ops/customers/export/route.ts`](/Users/amankumarshrestha/.codex/worktrees/1d2c/nabatableLP/src/app/api/ops/customers/export/route.ts)
  - reuse server function for batched full export

## Rollup Semantics To Preserve

- Exclude `PRIORITY_WAITLIST` from booking totals and covers.
- Count cancellations from `cancelled` and `no_show`.
- `lastVisitAt` must use past, non-cancelled occurrence time (`start_at`, fallback `created_at`).
- Null `lastVisitAt` sorts last in both directions.
- Summary semantics must match the currently verified live-booking helper.

## Testing Strategy

- Keep existing unit tests for the shared helper.
- Add server-layer tests for RPC row mapping and pagination behavior where practical.
- Run targeted typecheck/lint.
- Manual browser verification on the customers dev harness to confirm unchanged UI behavior.

## Rollout Notes

- Add a new SQL migration only; do not apply locally.
- Document remote apply requirement and rollback in the verification notes.
- If the migration is not yet applied remotely, server behavior will fail until rollout, so the final summary must call that out clearly.

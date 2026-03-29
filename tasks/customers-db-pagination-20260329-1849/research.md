---
task: customers-db-pagination
timestamp_utc: 2026-03-29T18:49:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Research: Customers DB Pagination Follow-up

## Requirements

- Eliminate the per-request full in-memory customer+booking rollup for the paginated ops customers API.
- Preserve the rebuilt live-booking semantics from the customers correctness pass.
- Keep the current client contract and operator workflows unchanged.
- Keep export aligned with the same canonical guest-history semantics.

## Current Architecture

- List route: [`src/app/api/ops/customers/route.ts`](/Users/amankumarshrestha/.codex/worktrees/1d2c/nabatableLP/src/app/api/ops/customers/route.ts)
- Export route: [`src/app/api/ops/customers/export/route.ts`](/Users/amankumarshrestha/.codex/worktrees/1d2c/nabatableLP/src/app/api/ops/customers/export/route.ts)
- Server query layer: [`server/ops/customers.ts`](/Users/amankumarshrestha/.codex/worktrees/1d2c/nabatableLP/server/ops/customers.ts)
- Canonical rollup semantics: [`lib/ops/customer-history.ts`](/Users/amankumarshrestha/.codex/worktrees/1d2c/nabatableLP/lib/ops/customer-history.ts)

## Findings

### 1. The correctness rebuild fixed trust, but not paginated query cost

- The current `getCustomersWithHistory()` rebuild derives guest history from live `customers + bookings`.
- It still fetches the full candidate customer set and all of their bookings on every page request, then filters/sorts/paginates in memory.
- This is correct but does not scale well for large restaurants or repeated page fetches from infinite scroll.

### 2. The old fast path was fast because it paged on `customer_profiles`

- Historical implementation in [`server/ops/customers.ts`](git show 2f4f6b7f) used DB pagination and sorting through `customer_profiles`.
- That path was efficient but semantically wrong because `customer_profiles.last_booking_at` was maintained from booking creation/cancellation side effects in [`server/customers.ts`](/Users/amankumarshrestha/.codex/worktrees/1d2c/nabatableLP/server/customers.ts), not from actual visit occurrence truth.

### 3. The repo already uses migration-backed RPCs for ops-heavy query paths

- Email delivery feed/summary already ship as SQL functions via [`supabase/migrations/20260206213430_ops_email_delivery_attempts_dashboard.sql`](/Users/amankumarshrestha/.codex/worktrees/1d2c/nabatableLP/supabase/migrations/20260206213430_ops_email_delivery_attempts_dashboard.sql).
- Server code consumes them through typed `supabase.rpc(...)`.
- This is the best existing pattern for moving expensive filtered/sorted aggregate work back into Postgres without changing the client contract.

### 4. Export does not need a one-shot “all rows” SQL path

- The real latency problem is the paginated API used by operators.
- Export can safely page through a DB-backed feed function in batches because it is a less frequent operator action.
- That lets us keep the SQL surface smaller: one feed RPC and one summary RPC.

## Recommended Direction

- Add a customers feed RPC that:
  - filters customer identities in SQL,
  - aggregates bookings in SQL,
  - computes `firstBookingAt`, `lastVisitAt`, `totalBookings`, `totalCovers`, `totalCancellations`,
  - applies aggregate-driven filters and sorting in SQL,
  - pages in SQL with page-size + 1 semantics for `hasNext`.
- Add a matching summary RPC over the same filtered aggregate set.
- Update `server/ops/customers.ts` to become an RPC mapping layer rather than an in-memory aggregation layer.
- Keep `lib/ops/customer-history.ts` as the canonical semantic reference and test target for rollup rules.

## Risks

- SQL semantics could drift from the shared helper if we do not mirror the same booking-status rules exactly.
- Generated Supabase types need to be patched alongside the migration or the RPC wiring will be untyped/brittle.
- We cannot apply the migration remotely from this environment, so rollout documentation must be explicit.

## Open Questions

- Whether to keep `customer_profiles` as a future cache/backfill target or fully demote it to optional metadata.
  - Working assumption: keep it out of the ops customers list path for now; do not broaden this pass into profile-maintenance refactors.

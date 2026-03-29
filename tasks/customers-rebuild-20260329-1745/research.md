---
task: customers-rebuild
timestamp_utc: 2026-03-29T17:45:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Research: Customers Page Rebuild

## Requirements

- Rebuild the customers/guests page from a trustworthy source of truth.
- Remove reliance on incorrect or stale guest rollup data.
- Preserve operator workflows: search, filters, sorting, infinite loading, export, focus deep-linking.
- Keep the production page on the real API path, not the dev-only in-memory service.
- Preserve accessibility and current page structure unless a user-visible correction is needed to fix incorrect data semantics.

## Current Architecture

- Route: [`src/app/app/(app)/customers/page.tsx`](</Users/amankumarshrestha/.codex/worktrees/1d2c/nabatableLP/src/app/app/(app)/customers/page.tsx>)
- Client shell: [`src/components/features/customers/OpsCustomersClient.tsx`](/Users/amankumarshrestha/.codex/worktrees/1d2c/nabatableLP/src/components/features/customers/OpsCustomersClient.tsx)
- Client query hook: [`src/components/features/customers/useOpsCustomersQueryState.ts`](/Users/amankumarshrestha/.codex/worktrees/1d2c/nabatableLP/src/components/features/customers/useOpsCustomersQueryState.ts)
- Client data hook: [`src/components/features/customers/useOpsCustomersDataState.ts`](/Users/amankumarshrestha/.codex/worktrees/1d2c/nabatableLP/src/components/features/customers/useOpsCustomersDataState.ts)
- Legacy query hook: [`hooks/useOpsCustomers.ts`](/Users/amankumarshrestha/.codex/worktrees/1d2c/nabatableLP/hooks/useOpsCustomers.ts)
- Browser service: [`src/services/ops/customers.ts`](/Users/amankumarshrestha/.codex/worktrees/1d2c/nabatableLP/src/services/ops/customers.ts)
- API route: [`src/app/api/ops/customers/route.ts`](/Users/amankumarshrestha/.codex/worktrees/1d2c/nabatableLP/src/app/api/ops/customers/route.ts)
- Server query layer: [`server/ops/customers.ts`](/Users/amankumarshrestha/.codex/worktrees/1d2c/nabatableLP/server/ops/customers.ts)

## Findings

### 1. The production page is not using the dev mock service

- The real customers page uses `createBrowserCustomerService()` and fetches `/api/ops/customers`.
- The dev harness swaps in [`src/app/(public)/dev/_mocks/services/devCustomerService.ts`](</Users/amankumarshrestha/.codex/worktrees/1d2c/nabatableLP/src/app/(public)/dev/_mocks/services/devCustomerService.ts>) only for `/dev/ops-customers`.
- This means the user’s distrust is best addressed by fixing the API/server data path, not by only adjusting dev fixtures.

### 2. The server list relies on `customer_profiles` snapshot data

- [`server/ops/customers.ts`](/Users/amankumarshrestha/.codex/worktrees/1d2c/nabatableLP/server/ops/customers.ts) joins `customers` to `customer_profiles` and uses that relation for:
  - `firstBookingAt`
  - `lastBookingAt`
  - `totalBookings`
  - `totalCovers`
  - `totalCancellations`
- Filters and sorting also depend on `customer_profiles.*`.
- If the snapshot drifts, the page stays fast-looking but becomes semantically wrong.

### 3. `customer_profiles` is updated from booking create/cancel side effects, not reconstructed from booking truth

- [`server/customers.ts`](/Users/amankumarshrestha/.codex/worktrees/1d2c/nabatableLP/server/customers.ts) updates `customer_profiles` incrementally through:
  - `recordBookingForCustomerProfile`
  - `recordCancellationForCustomerProfile`
- Critical correctness issue:
  - `recordBookingForCustomerProfile()` uses `booking.created_at`, not the booking visit/start time, when updating `first_booking_at` and `last_booking_at`.
- This strongly suggests the current “Last visit” field can be wrong even when the page logic itself is functioning as written.

### 4. Current guest semantics are mixed and hard to trust

- UI labels say “Last visit” and “Never visited”.
- Current data path uses:
  - booking-create timestamps for profile visit fields
  - summary buckets based on profile counters
  - VIP/returning determined from aggregate counts that may include stale or mismatched history
- Result: the code is internally consistent but not logically aligned with the meaning shown to operators.

### 5. The client architecture is cleaner than before, but still downstream of a wrong contract

- The recent optimization split query-state and data-state concerns successfully.
- However, those hooks still consume the same legacy `useOpsCustomers()` -> `/api/ops/customers` -> `customer_profiles` contract.
- Rewriting only the shell would not fix the underlying trust issue.

## Reuse Candidates

- Keep:
  - UI shell and layout in [`OpsCustomersClient.tsx`](/Users/amankumarshrestha/.codex/worktrees/1d2c/nabatableLP/src/components/features/customers/OpsCustomersClient.tsx)
  - table virtualization in [`CustomersTable.tsx`](/Users/amankumarshrestha/.codex/worktrees/1d2c/nabatableLP/src/components/features/customers/CustomersTable.tsx)
  - row/card view models in [`opsCustomersSelectors.ts`](/Users/amankumarshrestha/.codex/worktrees/1d2c/nabatableLP/src/components/features/customers/opsCustomersSelectors.ts)
  - query-string state management in [`useOpsCustomersQueryState.ts`](/Users/amankumarshrestha/.codex/worktrees/1d2c/nabatableLP/src/components/features/customers/useOpsCustomersQueryState.ts)
- Replace:
  - server customer rollup logic in [`server/ops/customers.ts`](/Users/amankumarshrestha/.codex/worktrees/1d2c/nabatableLP/server/ops/customers.ts)
  - API mapping assumptions in [`src/app/api/ops/customers/route.ts`](/Users/amankumarshrestha/.codex/worktrees/1d2c/nabatableLP/src/app/api/ops/customers/route.ts)
  - export path dependency on the same stale rollups

## Bottlenecks and Risk Areas

- Snapshot drift between `bookings` and `customer_profiles`.
- Semantics mismatch: “visit” vs “booking created”.
- Filters/sort derived from stale aggregates.
- Dev harness currently proves UI behavior, not data correctness.
- Rebuild risk is concentrated in the server/API contract and export parity.

## Recommended Direction

- Rebuild the customers page data path from `customers` + `bookings` truth, not `customer_profiles`.
- Compute guest rollups in the server layer using live booking data and explicit status/time semantics.
- Keep the client shell mostly intact, but point it at the rebuilt contract.
- Reuse the same canonical rollup helper for:
  - paged customers list
  - summary metrics
  - CSV export
  - dev harness fixture generation where practical

## Assumptions

- “Last visit” should be based on booking occurrence time, not customer record creation time.
- `PRIORITY_WAITLIST` should not count as a completed guest history booking.
- A user-visible wording change is acceptable if needed to correct a demonstrably wrong label or metric definition.

## Open Questions

- Whether VIP/Returning should be based on all valid bookings or only attended/past visits.
  - Working assumption for implementation: base “last visit” on past, non-cancelled booking occurrences; keep booking-count totals explicit and derived from valid booking history.

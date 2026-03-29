---
task: customers-rebuild
timestamp_utc: 2026-03-29T17:45:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Implementation Plan: Customers Page Rebuild

## Objective

We will rebuild the customers/guests data path from the server outward so operators see trustworthy guest history derived from booking truth instead of a stale profile snapshot.

## Success Criteria

- [ ] `/api/ops/customers` no longer depends on `customer_profiles` rollup fields for guest history metrics.
- [ ] Guest rows, sort, and filters are derived from a canonical live rollup helper.
- [ ] Export uses the same canonical rollup source as the page list.
- [ ] Operator behaviors remain intact: search, filters, sort, infinite loading, export, focus deep-link.
- [ ] The page no longer presents obviously wrong “last visit” semantics from booking creation timestamps.
- [ ] Dev-only mocking is isolated to the harness and does not define production behavior.

## Scope

### In scope

- Server-side customers query rewrite
- API response contract alignment
- Export alignment
- Client data hook wiring updates if needed
- Regression tests for rollup semantics and query filtering

### Out of scope

- New database migrations
- Broader guest CRM features
- Full visual redesign
- Changing unrelated bookings or auth flows

## Architecture

### Canonical layers

1. `server/ops/customers.ts`
   - Fetch customer rows for a restaurant with searchable identity fields.
   - Fetch booking rows for the candidate customer set.
   - Build canonical guest rollups in one pure helper.
   - Apply aggregate-driven filters/sort/pagination after rollup generation.

2. `src/app/api/ops/customers/route.ts`
   - Validate query input.
   - Enforce membership.
   - Call rebuilt server query.
   - Return DTOs mapped from canonical guest rollups.

3. `src/app/api/ops/customers/export/route.ts`
   - Reuse the same rollup source and semantics.

4. Client shell
   - Keep query-state and virtualization pieces if they still fit cleanly.
   - Avoid reintroducing mock-only assumptions into the production path.

## Data and Semantics

### Source of truth

- Identity fields: `customers`
- Booking history: `bookings`
- Optional profile metadata remains separate and not authoritative for booking rollups

### Proposed rollup semantics

- `totalBookings`
  - count of non-waitlist bookings for the customer
- `totalCovers`
  - sum of `party_size` for the same valid bookings
- `totalCancellations`
  - count of bookings with `status in ('cancelled', 'no_show')`
- `firstBookingAt`
  - earliest valid booking occurrence timestamp
- `lastVisitAt`
  - latest past booking occurrence timestamp where the booking was not cancelled/no-show
- `neverVisited`
  - no past, non-cancelled booking occurrence
- VIP / Returning
  - derived from canonical booking counts in one place, not from stale snapshots

If implementation reveals a better status rule based on existing domain code, document the adjustment in `verification.md`.

## Files to Change

- [`server/ops/customers.ts`](/Users/amankumarshrestha/.codex/worktrees/1d2c/nabatableLP/server/ops/customers.ts)
- [`src/app/api/ops/customers/route.ts`](/Users/amankumarshrestha/.codex/worktrees/1d2c/nabatableLP/src/app/api/ops/customers/route.ts)
- [`src/app/api/ops/customers/export/route.ts`](/Users/amankumarshrestha/.codex/worktrees/1d2c/nabatableLP/src/app/api/ops/customers/export/route.ts)
- [`hooks/useOpsCustomers.ts`](/Users/amankumarshrestha/.codex/worktrees/1d2c/nabatableLP/hooks/useOpsCustomers.ts) only if needed for contract or typing cleanup
- [`src/components/features/customers/useOpsCustomersDataState.ts`](/Users/amankumarshrestha/.codex/worktrees/1d2c/nabatableLP/src/components/features/customers/useOpsCustomersDataState.ts) only if data shape changes
- [`src/app/(public)/dev/_mocks/services/devCustomerService.ts`](</Users/amankumarshrestha/.codex/worktrees/1d2c/nabatableLP/src/app/(public)/dev/_mocks/services/devCustomerService.ts>) if we can cheaply align harness behavior to the new canonical helper

## Testing Strategy

- Pure unit tests for rollup helpers:
  - booking aggregation
  - last-visit derivation
  - cancellation counting
  - never-visited logic
- Route/server tests where practical for filter/sort semantics
- Existing customers table/selectors tests kept or updated only if contract changes
- Typecheck and targeted lint
- Chrome DevTools/manual verification on the dev harness for UI behavior

## Rollout and Risk

- No feature flag planned; this is a correctness rewrite of an existing page.
- Primary risk:
  - changing guest metrics semantics in a way that surprises operators
- Mitigation:
  - keep visible UI stable where possible
  - explicitly document any justified wording correction
  - test export parity against page semantics

## Fallback

- If the fully rebuilt rollup path becomes too broad for this pass, prioritize:
  1. replacing `customer_profiles`-based list metrics with live booking-derived metrics
  2. aligning export with the same helper
  3. keeping the current client shell intact

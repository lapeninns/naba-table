---
task: instant-ui-sprint1
timestamp_utc: 2025-11-26T14:44:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [ ] Confirm existing toast provider and query client configuration.
- [ ] Inventory queries/mutations and map to data types; finalize queryKeys helper location.
- [ ] Decide on optimistic helper pattern vs per-hook pattern.

## Core

- [ ] Implement/standardize `queryKeys` helper and refactor key queries to use it.
- [ ] Update toggle and booking mutations with onMutate/onError/onSettled (optimistic + rollback + invalidate checklist).
- [ ] Add staleTime/cacheTime per data type in queries.

## UI/UX

- [ ] Create skeleton primitives and replace spinners on settings, booking list, calendar.
- [ ] Add pending state indicators on toggles/buttons during mutation.
- [ ] Add route-level error boundaries with friendly fallback + retry.

## Tests

- [ ] Unit tests for queryKeys helper and optimistic mutation utilities.
- [ ] Integration tests for sample mutation (optimistic + rollback + toasts).
- [ ] Accessibility checks for skeletons and error fallback.

## Notes

- Assumptions: No DB schema changes; existing API contracts remain stable.
- Deviations: None yet.

## Batched Questions

- [ ] Confirm if feature flags infrastructure is available to gate optimistic behavior.

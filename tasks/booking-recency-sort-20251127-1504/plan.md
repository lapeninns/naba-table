---
task: booking-recency-sort
timestamp_utc: 2025-11-27T15:04:25Z
owner: github:@assistant
reviewers: []
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Booking recency sorting

## Objective

We will ensure new bookings appear first in the bookings list for the restaurant dashboard.

## Success Criteria

- [ ] Newly created booking appears at top immediately after creation.
- [ ] Sorting order remains correct after page reload and pagination.

## Architecture & Components

- Client already sends `sortBy=created_at&sort=desc` when the "recent" filter is active.
- API handler `src/app/api/ops/bookings/route.ts` currently ignores `sortBy` because the query param is not read before validation; this forces default `sortBy=start_at` on the server.

## Data Flow & API Contracts

- Ops bookings GET: `/api/ops/bookings?restaurantId=<id>&page&sort&sortBy`. Need to pass through `sortBy` to schema parsing so PostgREST query orders by `created_at` when requested.

## UI/UX States

- Loading / Empty / Error / Success

## Edge Cases

- Requests without `sortBy` should continue defaulting to `start_at` with existing asc/desc behavior.
- When `sortBy=created_at`, enforce deterministic ordering (`created_at DESC, id DESC`) even if timestamps tie.

## Testing Strategy

- Unit: extend `src/app/api/ops/bookings/route.test.ts` to assert the handler orders by `created_at` when `sortBy=created_at` is provided.
- Regression: ensure other query params (status, search, paging) stay untouched by the change.

## Rollout

- No feature flag currently planned; document if needed.

## DB Change Plan (if applicable)

- None expected; if needed, follow remote-only Supabase rules.

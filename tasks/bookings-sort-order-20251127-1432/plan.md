---
task: bookings-sort-order
timestamp_utc: 2025-11-27T14:32:42Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Ensure bookings list shows most recently created first

## Objective

Display bookings on the bookings page with the latest created booking first.

## Success Criteria

- [ ] Bookings list is ordered by creation datetime descending by default.
- [ ] Existing filters/pagination continue to work.

## Architecture & Components

- Ops bookings list uses client hook `useOpsBookingsList` backed by `/api/ops/bookings`. We'll adjust the API ordering logic to enforce `created_at` DESC when requested (Recent view) and keep other filters untouched.

## Data Flow & API Contracts

- Endpoint/Query: `/api/ops/bookings` (Supabase query).
- Change: when `sortBy=created_at`, force `created_at` DESC (with nulls last) so the Recent tab always shows latest-created bookings first.

## UI/UX States

- Should remain unchanged; only ordering changes.

## Edge Cases

- Same timestamp records should retain stable order if possible.
- Pagination should reflect new sort (descending).

## Testing Strategy

- Manual: load bookings page (Recent tab) and confirm the top row has the newest `created_at`; spot-check pagination retains order.
- Automated: add/update API handler test if present (none currently); otherwise rely on regression via manual QA.

## Rollout

- No feature flag; small surface change.
- Monitor for regressions in bookings list retrieval.

## DB Change Plan (if applicable)

- None.

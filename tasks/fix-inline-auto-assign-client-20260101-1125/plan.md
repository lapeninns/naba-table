---
task: fix-inline-auto-assign-client
timestamp_utc: 2026-01-01T11:25:51Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Fix inline auto-assign client propagation

## Objective

We will ensure inline auto-assign uses the caller-provided Supabase client so DB operations run in the correct environment.

## Success Criteria

- [ ] `runInlineAutoAssign` passes the provided client into all downstream DB calls.
- [ ] No behavior changes beyond client scoping.

## Architecture & Components

- `runInlineAutoAssign`: entry point for inline auto-assign; will forward client to downstream helpers.
- `quoteTablesForBooking`: quoting helper (client-aware).
- `atomicConfirmAndTransition`: confirmation helper (client-aware).

## Data Flow & API Contracts

- No API contract changes; only internal client propagation.

## UI/UX States

- N/A (no UI changes).

## Edge Cases

- Ensure default client behavior remains unchanged when no client is supplied.

## Testing Strategy

- Unit/Integration: rely on existing tests for inline auto-assign/booking routes.
- Manual: N/A (no UI change).

## Rollout

- No feature flags; minimal code change.

## DB Change Plan (if applicable)

- Not applicable.

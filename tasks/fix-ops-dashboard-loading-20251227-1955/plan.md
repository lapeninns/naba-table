---
task: fix-ops-dashboard-loading
timestamp_utc: 2025-12-27T19:55:13Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Ops dashboard loading stuck after summary fetch

## Objective

We will prevent the ops dashboard from remaining in a loading skeleton after the summary API succeeds so that operators see data on first load without a remount.

## Success Criteria

- [ ] `/dashboard` renders summary data on first load (no navigation workaround).
- [ ] No cross-user cache leakage (auth change still isolates data).
- [ ] No new console errors or regressions in loading states.

## Architecture & Components

- `hooks/useSupabaseSession.tsx`: source of session `status` (loading/authenticated/unauthenticated).
- `src/app/providers.tsx` QueryLayer: per-user query persistence and cache clearing.
- `src/hooks/ops/useOpsTodaySummary.ts`: summary query with `enabled` flag.

## Data Flow & API Contracts

Endpoint: GET /api/dashboard/summary?restaurantId=...&date=...
Response: OpsTodayBookingsSummary
Errors: 401/419 auth redirect; 403 forbidden; 500 server error

## UI/UX States

- Loading: skeleton until query enabled and data returned.
- Error: existing error state remains intact.
- Success: summary cards render immediately after first fetch.

## Edge Cases

- Session transitions from loading -> authenticated on initial mount.
- Auth change to a different user (should still clear cache).
- Restaurant membership not available (NoAccessState).

## Testing Strategy

- Unit: validate query enablement logic (if added).
- Integration/UI: load /dashboard with fresh session and verify data renders.
- Accessibility: ensure no changes to keyboard flow.

## Rollout

- No feature flag (bug fix).
- Monitor: client error logs for dashboard loading; confirm no increased auth redirects.

## DB Change Plan (if applicable)

- N/A.

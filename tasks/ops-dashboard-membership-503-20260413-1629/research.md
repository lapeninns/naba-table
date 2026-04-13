---
task: ops-dashboard-membership-503
timestamp_utc: 2026-04-13T16:29:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Ops dashboard membership validation 503 handling

## Requirements

- Functional:
  - When membership validation hits a transient Supabase upstream failure, ops dashboard APIs must not return `403 Forbidden`.
  - The dashboard summary, heatmap, changes, and rejections endpoints should return a retryable `503` response instead.
- Non-functional:
  - Keep normal auth failures and real permission failures unchanged.
  - Keep the fix scoped to the affected dashboard access pattern.

## Existing Patterns & Reuse

- `server/auth/guards.ts` already centralizes session and membership guard behavior for many ops routes.
- Dashboard routes were still using ad-hoc `getUser()` plus `requireMembershipForRestaurant()` handling and collapsed all membership errors to `403`.

## Constraints & Risks

- Supabase host failures are external and cannot be eliminated in-app; this change is about correct error semantics and graceful retry signaling.
- Dashboard routes are fan-out APIs, so the same guard behavior must be consistent across all four endpoints.

## Recommended Direction

- Classify transient membership-query upstream failures in `server/team/access.ts`.
- Map them to `503 MEMBERSHIP_VALIDATION_UNAVAILABLE` in `server/auth/guards.ts`.
- Reuse a shared dashboard access helper so all dashboard endpoints return the same status/code/retry header.

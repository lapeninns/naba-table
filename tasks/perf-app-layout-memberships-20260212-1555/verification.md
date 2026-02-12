---
task: perf-app-layout-memberships
timestamp_utc: 2026-02-12T15:55:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Verification

## Automated

- [x] `pnpm run typecheck`
- [x] `pnpm run lint` (warnings only; no errors)

## Manual

- [~] Hard reload `/app/floor-plan` shows materially improved TTFB on second refresh.
  - Blocked here: requires an authenticated local ops session.
  - Expected outcome after this change: membership lookup should be served from a 30s TTL in-memory cache on repeated reloads for the same `userId` (within the same Node process).
- [x] Logged-out users still redirect to `/app/auth/signin`.
  - Verified via browser navigation: `/app/floor-plan` resolves to `/app/auth/signin` when unauthenticated.

## Notes

- This optimization does not change membership validation rules; it only reduces repeated membership queries for server-rendered `/app/*` pages.
- Cache TTL: 30 seconds. Cache is bounded to 5000 entries.

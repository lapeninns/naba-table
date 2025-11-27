---
task: host-routing-auth
timestamp_utc: 2025-11-27T17:55:35Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [ ] Confirm host detection/env vars; map root vs app domains for local dev.
- [ ] Inventory middleware and auth utilities; identify existing guards.

## Core

- [x] Implement middleware static/framework exclusions.
- [x] Normalize root `/app*` and `/ops*` redirects to app host with single `/app` prefix; prevent loops.
- [x] Normalize app host `/app/app*` → `/app*`; add non-app/api/static redirect to root host.
- [x] Add `opsServices` map and rewrite `/api/<service>` → `/api/ops/<service>` on app host; avoid double rewrites and skip public schedule endpoints.
- [ ] Add shared ops guard to all `/api/ops/**` handlers (middleware guard in place; handler-level refactor pending).
- [ ] Configure auth cookie strategy (guest vs restaurant) and host-aware post-sign-in redirect helper (helper added; cookie decision pending).

## UI/UX

- [ ] Ensure login redirects land on correct host/path; preserve focus/ARIA patterns if UI adjusted.

## Tests

- [ ] Add middleware tests for `/app`, `/app/app`, `/ops`, static paths on both hosts.
- [ ] Add rewrite tests for `opsServices` including no double-rewrite case.
- [ ] Add auth guard tests: 401 unauth, 403 guest, success restaurant.
- [ ] Add redirect helper tests for host/role combinations.

## Notes

- Assumptions:
  - Env exposes root/app host or derivable root domain.
- Deviations:
  - 2025-11-27: Adjusted import order in `src/app/layout.tsx` and mock typing in `src/middleware.test.ts` for lint compliance; unable to rerun eslint locally due to exec tool PTY error—needs follow-up verification.

## Batched Questions

- How is role stored in session currently? Need to align guard implementation.
- Do existing tests target middleware? Which harness to extend (e.g., Next middleware tester)?

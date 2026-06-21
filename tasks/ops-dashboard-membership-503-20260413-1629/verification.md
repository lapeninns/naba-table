---
task: ops-dashboard-membership-503
timestamp_utc: 2026-04-13T16:29:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Verification Report

## Test Outcomes

- [x] `pnpm vitest run tests/server/ops-dashboard-summary-route.test.ts tests/server/public-bookings-route.test.ts`
- [x] `pnpm typecheck`
- [x] Focused ESLint pass on touched dashboard/auth files

## Production Incident Reference

- Source log: `/api/ops/dashboard/summary`
- Failure mode: Supabase upstream returned Cloudflare `502 Bad gateway` HTML during membership validation.
- Previous behavior: route returned `403 Forbidden`.
- New behavior: dashboard routes return `503 MEMBERSHIP_VALIDATION_UNAVAILABLE` with `Retry-After: 30`.

## Known Issues

- [ ] This patch improves error semantics and retry guidance; it does not prevent transient Supabase upstream incidents themselves.

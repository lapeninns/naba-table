---
task: fix-booking-dashboard
timestamp_utc: 2026-01-03T01:45:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

Tool: Chrome DevTools MCP

### Console & Network

- [ ] No Console errors (not run)
- [ ] Network requests match contract (not run)

### DOM & Accessibility

- [ ] Semantic HTML verified (not run)
- [ ] ARIA attributes correct (not run)
- [ ] Focus order logical & visible (not run)
- [ ] Keyboard-only flows succeed (not run)

### Performance (profiled; mobile; 4x CPU; 4G)

- FCP: TBD s | LCP: TBD s | CLS: TBD | TBT: TBD ms
- Budgets met: [ ] Yes [ ] No (not run)

### Device Emulation

- [ ] Mobile (approx 375px) [ ] Tablet (approx 768px) [ ] Desktop (>=1280px) (not run)

## Test Outcomes

- [ ] Happy paths
- [ ] Error handling
- [ ] A11y (axe): 0 critical/serious

### Automated

- `pnpm run lint` (warnings only, rerun):
  - lib/owner/team/schema.ts (unused var)
  - lib/profile/server.ts (explicit any)
  - lib/reservations/share.ts (unused var)
  - server/booking-reference.ts (explicit any)
  - server/bookingHistory.ts (explicit any)
  - server/capacity/service.ts (explicit any)
  - server/ops/booking-lifecycle/history.ts (explicit any)
  - server/ops/booking-lifecycle/summary.ts (explicit any)
  - server/ops/customer-profiles.ts (explicit any)
  - server/restaurants/delete.ts (explicit any)
  - server/restaurants/operatingHours.ts (explicit any)
  - server/team/access.ts (explicit any)
  - server/team/invitations.ts (explicit any)
- `pnpm run typecheck` (pass)
- `pnpm run test` (failed; existing failures):
  - tests/server/homepage-redirect.test.tsx (2)
  - src/app/api/auth/signin/route.test.ts (2)
  - src/app/api/bookings/route.test.ts (4)
  - src/app/api/ops/bookings/route.test.ts (2)
  - src/app/api/bookings/[id]/route.test.ts (3)

## Artifacts

- Lighthouse: artifacts/lighthouse-report.json
- Network: artifacts/network.har
- Traces/Screens: artifacts/
- DB diff (if DB change): artifacts/db-diff.txt

## Known Issues

- [ ] Manual QA via Chrome DevTools MCP not run
- [ ] Test failures listed above (pre-existing)

## Sign-off

- [ ] Engineering
- [ ] Design/PM
- [ ] QA

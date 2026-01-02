---
task: floor-plan-reference
timestamp_utc: 2026-01-02T20:25:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

Tool: Chrome DevTools MCP

### Console & Network

- [ ] No Console errors
- [ ] Network requests match contract

Status: Not run (Chrome DevTools MCP not available in this session).

### DOM & Accessibility

- [ ] Semantic HTML verified
- [ ] ARIA attributes correct
- [ ] Focus order logical & visible
- [ ] Keyboard-only flows succeed

### Performance (profiled; mobile; 4× CPU; 4G)

- FCP: <value> s | LCP: <value> s | CLS: <value> | TBT: <value> ms
- Budgets met: [ ] Yes [ ] No (notes)

### Device Emulation

- [ ] Mobile (≈375px) [ ] Tablet (≈768px) [ ] Desktop (≥1280px)

## Test Outcomes

- [x] Lint (warnings only; no errors)
- [x] Typecheck
- [ ] Unit/integration tests (vitest) - failed (same failures as earlier run)

Lint warnings (pre-existing):

- `lib/owner/team/schema.ts` unused `RESTAURANT_ROLES`
- `lib/profile/server.ts` explicit any (2)
- `lib/reservations/share.ts` unused `DEFAULT_SHARE_TITLE`
- `server/booking-reference.ts` explicit any (2)
- `server/bookingHistory.ts` explicit any
- `server/capacity/service.ts` explicit any
- `server/ops/booking-lifecycle/history.ts` explicit any
- `server/ops/booking-lifecycle/summary.ts` explicit any
- `server/ops/customer-profiles.ts` explicit any
- `server/restaurants/delete.ts` explicit any
- `server/restaurants/operatingHours.ts` explicit any
- `server/team/access.ts` explicit any
- `server/team/invitations.ts` explicit any

Failed tests:

- `src/app/api/auth/signin/route.test.ts` (2 failures)
- `src/app/api/bookings/route.test.ts` (4 failures)
- `src/app/api/ops/bookings/route.test.ts` (2 failures)
- `src/app/api/bookings/[id]/route.test.ts` (3 failures)

## Artifacts

- Lighthouse: `artifacts/lighthouse-report.json`
- Network: `artifacts/network.har`
- Traces/Screens: `artifacts/`

## Known Issues

- [ ] `pnpm run test` fails in multiple API route tests (see Test Outcomes). (owner: github:@maintainers, priority: medium)

## Sign-off

- [ ] Engineering
- [ ] Design/PM
- [ ] QA

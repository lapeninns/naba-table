---
task: landing-page-replace
timestamp_utc: 2026-01-02T21:36:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

Tool: Chrome DevTools MCP
Status: Not run in this environment.

### Console & Network

- [ ] No Console errors
- [ ] Network requests match contract

### DOM & Accessibility

- [ ] Semantic HTML verified
- [ ] ARIA attributes correct
- [ ] Focus order logical & visible
- [ ] Keyboard-only flows succeed

### Performance (profiled; mobile; 4x CPU; 4G)

- FCP: _ s | LCP: _ s | CLS: _ | TBT: _ ms
- Budgets met: [ ] Yes [ ] No (notes)

### Device Emulation

- [ ] Mobile (≈375px) [ ] Tablet (≈768px) [ ] Desktop (>=1280px)

## Test Outcomes

- [x] Lint: warnings only (pre-existing)
  - lib/owner/team/schema.ts:3:35 @typescript-eslint/no-unused-vars
  - lib/profile/server.ts:177:46, 265:46 @typescript-eslint/no-explicit-any
  - lib/reservations/share.ts:25:7 @typescript-eslint/no-unused-vars
  - server/booking-reference.ts:19:36, 19:41 @typescript-eslint/no-explicit-any
  - server/bookingHistory.ts:26:52 @typescript-eslint/no-explicit-any
  - server/capacity/service.ts:16:52 @typescript-eslint/no-explicit-any
  - server/ops/booking-lifecycle/history.ts:7:52 @typescript-eslint/no-explicit-any
  - server/ops/booking-lifecycle/summary.ts:8:52 @typescript-eslint/no-explicit-any
  - server/ops/customer-profiles.ts:7:52 @typescript-eslint/no-explicit-any
  - server/restaurants/delete.ts:7:52 @typescript-eslint/no-explicit-any
  - server/restaurants/operatingHours.ts:10:52 @typescript-eslint/no-explicit-any
  - server/team/access.ts:8:52 @typescript-eslint/no-explicit-any
  - server/team/invitations.ts:13:52 @typescript-eslint/no-explicit-any
- [x] Typecheck: pass (`pnpm run typecheck`)
- [x] Tests: failed (`pnpm run test`)
  - src/app/api/auth/signin/route.test.ts (2 failed)
  - src/app/api/bookings/route.test.ts (4 failed)
  - src/app/api/bookings/[id]/route.test.ts (3 failed)
  - src/app/api/ops/bookings/route.test.ts (2 failed)
- Notes: Re-ran after UK pubs landing copy update; failures unchanged.

## Artifacts

- Lighthouse: `artifacts/`
- Network: `artifacts/`
- Traces/Screens: `artifacts/`

## Known Issues

- [ ] Test failures in API route suites listed above.

## Sign-off

- [ ] Engineering
- [ ] Design/PM
- [ ] QA

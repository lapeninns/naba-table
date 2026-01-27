---
task: fix-booking-hydration
timestamp_utc: 2026-01-27T09:39:49Z
owner: github:@codex
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: [90787006]
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

Tool: Chrome DevTools MCP

### Console & Network

- Opened: `http://localhost:3000/bookings/e19914d4-8761-4c38-a380-ff00819c2544`
- Result: redirected to `http://localhost:3000/auth/signin?redirectedFrom=...` due to missing session in local dev.
- Console: no hydration errors observed on the sign-in page; booking detail route verification is blocked by auth/data.
- Network: booking detail contract could not be validated locally because the route requires auth or recovery cookie.

### DOM & Accessibility

- Blocked for booking detail route due to auth redirect in local dev.

### Performance (profiled; mobile; 4× CPU; 4G)

- FCP: <value> s | LCP: <value> s | CLS: <value> | TBT: <value> ms
- Budgets met: [ ] Yes [ ] No (notes)
- Not measured: booking detail route is auth-gated in local dev.

### Device Emulation

- Not completed for booking detail route due to auth redirect.

## Test Outcomes

- `npx vitest run reserve/shared/formatting/booking.test.ts` — 2 passed.
- `npx vitest run tests/ops/booking-details-utils.test.tsx tests/ops/booking-details-hook.test.tsx` — 5 passed.
- `npm run lint` — 0 errors, 15 pre-existing warnings in `lib/**` and `server/**`.
- `pnpm typecheck` — failed due to stale `.next/types/validator.ts` references to missing route files (unrelated to this change).

## Artifacts

- Lighthouse: `artifacts/lighthouse-report.json`
- Network: `artifacts/network.har`
- Traces/Screens: `artifacts/`
- DB diff (if DB change): `artifacts/db-diff.txt`
- DevTools notes: `artifacts/devtools-notes.txt`

## Known Issues

- Local DevTools QA for `/bookings/[id]` is blocked by auth/data constraints.

## Sign-off

- [ ] Engineering
- [ ] Design/PM
- [ ] QA

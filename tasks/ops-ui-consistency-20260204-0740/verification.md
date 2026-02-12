---
task: ops-ui-consistency
timestamp_utc: 2026-02-04T07:40:00Z
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

- Dashboard: warnings about multiple GoTrueClient instances and unused preload hints.
- Settings (restaurant profile): `ERR_CONNECTION_CLOSED` + Supabase `getUser` fetch error observed.
- Bookings/Customers/Settings Tables: no console errors (Fast Refresh logs only).

### DOM & Accessibility

- Verified heading hierarchy and primary actions presence across dashboard, bookings, customers, settings.
- Search inputs render as `type="search"` with focus-visible styles and clear labels.

### Performance (profiled; local, unthrottled)

- Dashboard trace captured: LCP 2004 ms, CLS 0.00. (Trace file removed during cleanup.)

### Device Emulation

- Desktop viewport used for QA snapshots.

## Test Outcomes

- Lint: `pnpm eslint --max-warnings=0 src/components/features/ops-shell src/components/features/dashboard src/components/features/bookings src/components/features/customers src/components/features/seating src/components/features/restaurant-settings src/components/features/tables src/components/features/team`
- Typecheck: `pnpm typecheck`

## Artifacts

- Screenshots:
  - `artifacts/dashboard.png`
  - `artifacts/bookings.png`
  - `artifacts/customers.png`
  - `artifacts/settings-restaurant-profile.png`
  - `artifacts/settings-tables.png`

## Known Issues

- Settings profile page failed to fetch Supabase user (`ERR_CONNECTION_CLOSED`).
- Dashboard preload warnings for unused chunks (likely prefetch timing).

## Sign-off

- [ ] Engineering
- [ ] Design/PM
- [ ] QA

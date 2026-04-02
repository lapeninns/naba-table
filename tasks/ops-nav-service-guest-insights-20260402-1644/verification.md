---
task: ops-nav-service-guest-insights
timestamp_utc: 2026-04-02T16:45:54Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: low
flags: []
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

Tool: Chrome DevTools MCP

### Console & Network

- [x] No console errors introduced by the nav regrouping
- [x] Navigation shell loads successfully via `http://127.0.0.1:3001/dev/ops-navigation`

### DOM & Accessibility

- [x] Sidebar section labels render as expected
- [x] Keyboard navigation still reaches the nav items in order

### Device Emulation

- [x] Desktop verified

## Test Outcomes

- [x] `npx eslint 'src/components/features/ops-shell/navigation.tsx' 'src/app/(public)/dev/ops-navigation/ui/OpsNavigationDevHarness.tsx' 'src/app/(public)/dev/ops-navigation/page.tsx' 'src/app/app/dev/ops-navigation/page.tsx'`

## Artifacts

- Screenshot: `artifacts/ops-nav-service-guest-insights.png`

## Known Issues

- [x] None identified

## Sign-off

- [x] Engineering

## Notes

- Added a dev-only verification route at `/dev/ops-navigation` plus an `/app`-prefixed companion route for local ops-shell QA without requiring an authenticated session.
- Verified the final sidebar grouping:
- `Service`: Dashboard, Bookings, New Bookings, Floor Plan
- `Guest & Insights`: Guests, Email Delivery, Email Templates, Rejections

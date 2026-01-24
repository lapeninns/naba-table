---
task: ops-dashboard-print
timestamp_utc: 2026-01-24T19:16:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: [feat.ops.print_bookings]
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

Tool: Chrome DevTools MCP

Notes:

- Logged in with ops credentials and verified dashboard + print route.
- Console shows a 404 for `/monitoring` and a GoTrue multiple-client warning (pre-existing dev noise).
- Verified print view requests summary with `date` query param when provided.

### Console & Network

- [ ] No Console errors (404 to `/monitoring` observed)
- [x] Network requests match contract (ops dashboard summary fetched)

### DOM & Accessibility

- [x] Semantic HTML verified (table headers, headings, labels)
- [x] ARIA attributes correct (print button labeled)
- [x] Focus order logical & visible
- [x] Keyboard-only flows succeed

### Performance (profiled; mobile; 4× CPU; 4G)

- FCP: <value> s | LCP: <value> s | CLS: <value> | TBT: <value> ms
- Budgets met: [ ] Yes [ ] No (notes)

### Device Emulation

- [ ] Mobile (≈375px) [ ] Tablet (≈768px) [x] Desktop (≥1280px)

## Test Outcomes

- [x] Happy paths
- [ ] Error handling
- [ ] A11y (axe): 0 critical/serious

## Artifacts

- Lighthouse: `artifacts/lighthouse-report.json` (not run)
- Network: `artifacts/network.har` (not captured)
- Traces/Screens: `artifacts/dashboard-print-button.png`, `artifacts/print-view.png`
- DB diff (if DB change): `artifacts/db-diff.txt`

## Known Issues

- [ ] Dev console shows 404 on `/monitoring` (likely Sentry dev endpoint) and GoTrue multiple-client warning (owner: platform, priority: low).

## Sign-off

- [ ] Engineering
- [ ] Design/PM
- [ ] QA

---
task: browse-partner-restaurants-revamp
timestamp_utc: 2025-11-23T01:06:47Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

Tool: Chrome DevTools MCP
Session: localhost:3000/restaurants (desktop + resized mobile)

### Console & Network

- [x] No Console errors (verified via DevTools console)
- [x] Network requests match contract (SSR + cached React Query; no failed requests)

### DOM & Accessibility

- [x] Semantic HTML verified (headings, list, dl, live status)
- [x] ARIA attributes correct (aria-live on status/error)
- [x] Focus order logical & visible (standard link/button focus rings)
- [x] Keyboard-only flows succeed (tab through CTAs and links)

### Performance (profiled; mobile; 4× CPU; 4G)

- FCP: not measured (dev server) | LCP: not measured | CLS: not measured | TBT: not measured
- Budgets met: [ ] Yes [x] No (not measured; dev mode)

### Device Emulation

- [x] Mobile (≈375-430px) [ ] Tablet (≈768px) [x] Desktop (≥1280px)

## Test Outcomes

- [ ] Happy paths
- [ ] Error handling
- [ ] A11y (axe): 0 critical/serious
- Notes: `pnpm exec eslint components/marketing/RestaurantBrowser.tsx lib/restaurants/types.ts server/restaurants/listRestaurants.ts`

## Artifacts

- Lighthouse: `artifacts/lighthouse-report.json`
- Network: `artifacts/network.har`
- Traces/Screens: `artifacts/restaurant-browser.png`, `artifacts/restaurant-browser-mobile.png`
- DB diff (if DB change): `artifacts/db-diff.txt`

## Known Issues

- [ ] (owner, priority)

## Sign-off

- [ ] Engineering
- [ ] Design/PM
- [ ] QA

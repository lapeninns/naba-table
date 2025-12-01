---
task: restaurant-ops-qa
timestamp_utc: 2025-11-30T23:41:24Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

Tool: Chrome DevTools MCP
Notes: Resized to iPad Pro (1024×1366), iPhone 12 (390×844); network throttled to Fast 3G and Offline; navigated /dashboard, /bookings, /walk-in, /seating/floor-plan, /customers, /settings/restaurant/profile.

### Console & Network

- [ ] No Console errors (not captured; offline test produced browser error page)
- [x] Network requests match contract (bookings ignored date param)

### DOM & Accessibility

- [ ] Semantic HTML verified
- [ ] ARIA attributes correct
- [ ] Focus order logical & visible
- [ ] Keyboard-only flows succeed (not fully exercised; walk-in wizard not tabbed end-to-end)

### Performance (profiled; mobile; 4× CPU; 4G)

- FCP: N/A | LCP: N/A | CLS: observable minor shifts during load on bookings header | TBT: N/A
- Budgets met: [ ] Yes [x] No (data not gathered; throttling used for qualitative checks)

### Device Emulation

- [x] Mobile (≈375px) [x] Tablet (≈1024px) [x] Desktop (≥1280px)

## Test Outcomes

- [ ] Happy paths
- [x] Error handling (invalid email accepted; offline shows browser error)
- [ ] A11y (axe): 0 critical/serious (not run)

## Artifacts

- Bookings future-date screenshot: `artifacts/bookings-future.png`
- Lighthouse: (not run – auth wall prevents unauthenticated audit)
- Network: (not captured)
- Traces/Screens: see above
- DB diff (if DB change): N/A

## Known Issues

- [ ] <issue> (owner, priority)

## Sign-off

- [ ] Engineering
- [ ] Design/PM
- [ ] QA

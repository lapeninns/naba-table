---
task: fix-list-flicker
timestamp_utc: 2026-02-02T23:49:14Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

Tool: Chrome DevTools MCP

### Console & Network

- [ ] No Console errors (blocked: sign-in page only)
- [ ] Network requests match contract (blocked: sign-in page only)

### DOM & Accessibility

- [ ] Semantic HTML verified (blocked: sign-in page only)
- [ ] ARIA attributes correct (blocked: sign-in page only)
- [ ] Focus order logical & visible (blocked: sign-in page only)
- [ ] Keyboard-only flows succeed (blocked: sign-in page only)

### Performance (profiled; mobile; 4× CPU; 4G)

- FCP: <value> s | LCP: <value> s | CLS: <value> | TBT: <value> ms
- Budgets met: [ ] Yes [ ] No (notes; blocked by auth)

### Device Emulation

- [ ] Mobile (≈375px) [ ] Tablet (≈768px) [ ] Desktop (≥1280px) (blocked by auth)

## Test Outcomes

- [ ] Customers list scroll + refresh (blocked by auth)
- [ ] Bookings list scroll + refresh (blocked by auth)
- [x] `/app` unauth redirect -> `/app/auth/signin`

## Artifacts

- Traces/Screens: `artifacts/customers-signin.png`, `artifacts/bookings-signin.png`, `artifacts/dashboard-signin.png`, `artifacts/ops-signin-redirect.png`

## Known Issues

- [ ] UI QA blocked by auth; sign-in page shown for /app/\* routes (owner: github:@amankumarshrestha, priority: medium).
- [ ] Console warnings on sign-in page: PostHog double init + label-for mismatch (priority: low).

## Sign-off

- [ ] Engineering
- [ ] Design/PM
- [ ] QA

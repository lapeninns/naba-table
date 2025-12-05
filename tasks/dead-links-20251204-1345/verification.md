---
task: dead-links
timestamp_utc: 2025-12-04T13:45:00Z
owner: github:@amankumarshrestha
reviewers: []
risk: medium
flags: []
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

Tool: Chrome DevTools MCP

### Console & Network

- [ ] No console errors
- [ ] Network requests match expectations

### DOM & Accessibility

- [ ] Semantic HTML verified
- [ ] ARIA attributes correct
- [ ] Focus order logical & visible
- [ ] Keyboard-only flows succeed

### Performance (mobile; 4× CPU; 4G)

- FCP: _ s | LCP: _ s | CLS: _ | TBT: _ ms
- Budgets met: [ ] Yes [ ] No (notes)

### Device Emulation

- [ ] Mobile (≈375px) [ ] Tablet (≈768px) [ ] Desktop (≥1280px)

## Test Outcomes

- [ ] Happy paths
- [ ] Error handling
- [ ] A11y (axe): 0 critical/serious

## Artifacts

- Lighthouse: `artifacts/lighthouse-report.json`
- Network: `artifacts/network.har`
- Traces/Screens: `artifacts/`
- DB diff (if DB change): `artifacts/db-diff.txt`

## Known Issues

- [ ] Manual Chrome DevTools QA not yet run (pending after server spin-up)

## Sign-off

- [ ] Engineering
- [ ] Design/PM
- [ ] QA

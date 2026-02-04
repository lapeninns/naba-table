---
task: fix-replay-ops-card-hydration
timestamp_utc: 2026-02-04T19:07:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

Tool: Chrome DevTools MCP

### Console & Network

- [ ] No Console errors
- [ ] Network requests match contract

### DOM & Accessibility

- [ ] Semantic HTML verified
- [ ] ARIA attributes correct
- [ ] Focus order logical & visible
- [ ] Keyboard-only flows succeed

### Performance (profiled; mobile; 4× CPU; 4G)

- FCP: \_ s | LCP: \_ s | CLS: \_ | TBT: \_ ms
- Budgets met: [ ] Yes [ ] No

### Device Emulation

- [ ] Mobile (≈375px) [ ] Tablet (≈768px) [ ] Desktop (≥1280px)

## Test Outcomes

- [ ] Unit (not run)
- [ ] Integration (not run)
- [ ] E2E (not run)
- [ ] A11y (axe): 0 critical/serious (not run)

## Artifacts

- Lighthouse: `artifacts/`
- Network: `artifacts/`
- Screens: `artifacts/`

## Known Issues

- [ ] None.

## Sign-off

- [ ] Engineering
- [ ] Design/PM
- [ ] QA

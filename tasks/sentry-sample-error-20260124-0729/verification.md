---
task: sentry-sample-error
timestamp_utc: 2026-01-24T07:29:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

Tool: Chrome DevTools MCP

### Console & Network

- [ ] No Console errors unrelated to the triggered error
- [ ] Network requests match contract

### DOM & Accessibility

- [ ] Semantic HTML verified
- [ ] ARIA attributes correct
- [ ] Focus order logical & visible
- [ ] Keyboard-only flows succeed

### Performance (profiled; mobile; 4× CPU; 4G)

- FCP: TBD s | LCP: TBD s | CLS: TBD | TBT: TBD ms
- Budgets met: [ ] Yes [ ] No (notes)

### Device Emulation

- [ ] Mobile (≈375px) [ ] Tablet (≈768px) [ ] Desktop (≥1280px)

## Test Outcomes

- [ ] Happy paths
- [ ] Error handling
- [ ] A11y (axe): 0 critical/serious

## Artifacts

- Lighthouse: `tasks/sentry-sample-error-20260124-0729/artifacts/lighthouse-report.json`
- Network: `tasks/sentry-sample-error-20260124-0729/artifacts/network.har`
- Traces/Screens: `tasks/sentry-sample-error-20260124-0729/artifacts/`

## Known Issues

- [ ] LSP diagnostics not run (typescript-language-server not installed).

## Sign-off

- [ ] Engineering
- [ ] Design/PM
- [ ] QA

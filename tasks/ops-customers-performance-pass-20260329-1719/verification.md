---
task: ops-customers-performance-pass
timestamp_utc: 2026-03-29T17:19:25Z
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

- [x] No new customers-page console errors after adding `name` attributes to the filter selects
- [x] Network requests stayed on the dev harness route and returned `200`

### DOM & Accessibility

- [x] Semantic structure verified for header, filter toolbar, metrics region, and guest cards
- [x] Focus targeting preserved for `?focus=sam.patel@example.com`

### Performance

- [x] Customers list remained responsive during `sam.patel` search narrowing
- [x] No hydration/runtime regressions observed in the local harness

### Device Emulation

- [x] Mobile
- [x] Desktop

## Test Outcomes

- [x] Selector/view-model tests
- [x] Component tests
- [x] Typecheck
- [x] Lint

## Artifacts

- [x] Added command/test logs to `artifacts/checks.txt`
- [x] Added dev-harness screenshot to `artifacts/ops-customers-dev-harness.png`

## Known Issues

- Local dev harness still shows the baseline PostHog missing-env warning because this verification run used dummy local env values. No new customers-specific warnings remained.

## Sign-off

- [ ] Engineering

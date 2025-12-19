---
task: lint-guest-view-models-any
timestamp_utc: 2025-12-05T15:38:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

Tool: Not applicable (server-side lint fix only; no UI changes).

### Console & Network

- [ ] No console errors (N/A)
- [ ] Network requests match contract (N/A)

### DOM & Accessibility

- [ ] Semantic HTML verified (N/A)
- [ ] ARIA attributes correct (N/A)
- [ ] Focus order logical & visible (N/A)
- [ ] Keyboard-only flows succeed (N/A)

### Performance (profiled; mobile; 4× CPU; 4G)

- FCP: N/A | LCP: N/A | CLS: N/A | TBT: N/A
- Budgets met: [ ] Yes [x] No (not applicable)

### Device Emulation

- [ ] Mobile (≈375px) [ ] Tablet (≈768px) [ ] Desktop (≥1280px)

## Test Outcomes

- [ ] Happy paths (N/A)
- [ ] Error handling (N/A)
- [ ] A11y (axe): 0 critical/serious (N/A)
- [x] Lint: `pnpm eslint tests/server/guest/view-models.test.ts --max-warnings=0`

## Artifacts

- Lint output: `pnpm eslint tests/server/guest/view-models.test.ts --max-warnings=0` (pass; engine warning about Node 22 vs required 20.11.1)

## Known Issues

- None documented yet.

## Sign-off

- [ ] Engineering
- [ ] Design/PM
- [ ] QA

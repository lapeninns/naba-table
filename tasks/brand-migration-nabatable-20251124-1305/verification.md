---
task: brand-migration-nabatable
timestamp_utc: 2025-11-24T13:05:00Z
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

- [x] No Console errors observed while loading `/`, `/auth/signin`, `/thank-you` (dev server logs clean)
- [x] Network requests match contract (200 responses for marketing/auth pages; redirect to signin for protected dashboard)

### DOM & Accessibility

- [x] Semantic HTML verified on marketing + auth pages
- [x] ARIA attributes correct (forms/buttons labeled; headings present)
- [x] Focus order logical & visible (skip link present)
- [x] Keyboard-only flows succeed (tab through hero CTAs/sign-in form)

### Performance (profiled; mobile; 4× CPU; 4G)

- FCP: n/a | LCP: n/a | CLS: n/a | TBT: n/a (not benchmarked this run)
- Budgets met: [ ] Yes [x] No (notes: perf profiling skipped; run Lighthouse later if needed)

### Device Emulation

- [ ] Mobile (≈375px) [ ] Tablet (≈768px) [ ] Desktop (≥1280px)

## Test Outcomes

- [x] Happy paths (vitest suite)
- [x] Error handling
- [ ] A11y (axe): 0 critical/serious (not automated; manual checks only)

Notes: `pnpm test` (vitest) passed locally after branding updates.

## Artifacts

- Lighthouse: `artifacts/lighthouse-report.json`
- Network: `artifacts/network.har`
- Traces/Screens: `artifacts/`
- DB diff (if DB change): `artifacts/db-diff.txt`

## Known Issues

- [ ] <issue> (owner, priority)

## Sign-off

- [ ] Engineering
- [ ] Design/PM
- [ ] QA

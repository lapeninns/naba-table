---
task: upgrade-dependencies-react
timestamp_utc: 2025-12-03T17:37:42Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: high
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

- FCP: <value> s | LCP: <value> s | CLS: <value> | TBT: <value> ms
- Budgets met: [ ] Yes [ ] No (notes)

### Device Emulation

- [ ] Mobile (≈375px) [ ] Tablet (≈768px) [ ] Desktop (≥1280px)

## Test Outcomes

- [ ] Happy paths
- [ ] Error handling
- [ ] A11y (axe): 0 critical/serious
- Lint: `pnpm run lint` (warnings only; pre-existing `any`/unused vars).
- Tests: `pnpm run test` failing (10 tests, 13 suites). Key issues:
  - Missing module resolutions for `@/tests/fixtures/wizard`, `@/hooks/useGlobalShortcuts`, `@/scripts/db/safety`.
  - Supabase auth callback tests failing: `cookies` called outside request scope under Next 16.
  - Auth signin expectations changed: `shouldCreateUser` now false by default and redirect host now uses production domain.
  - Occasions route test returning 500 (mock missing `getServiceSupabaseClient`).
  - Capacity tests failing due to Supabase table inventory RPC errors.
- Build: `pnpm run build` (succeeds; middleware deprecation warning from Next).

## Artifacts

- Lighthouse: `artifacts/lighthouse-report.json`
- Network: `artifacts/network.har`
- Traces/Screens: `artifacts/`
- DB diff (if DB change): `artifacts/db-diff.txt`
- Outdated snapshot: `artifacts/pnpm-outdated.json`, post-upgrade `pnpm-outdated-after.json`
- Vitest JSON report: `artifacts/vitest-report.json`

## Known Issues

- [ ] <issue> (owner, priority)

## Sign-off

- [ ] Engineering
- [ ] Design/PM
- [ ] QA

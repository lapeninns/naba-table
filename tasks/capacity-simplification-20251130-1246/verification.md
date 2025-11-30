---
task: capacity-simplification
timestamp_utc: 2025-11-30T12:46:00Z
owner: github:@amankumarshrestha
reviewers: []
risk: high
flags: []
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

Tool: Chrome DevTools MCP (UI changes not expected; perform smoke if any UI surface touched)

### Console & Network

- [ ] No console errors
- [ ] Network requests match contract

### DOM & Accessibility

- [ ] Semantic HTML verified (if UI touched)
- [ ] ARIA attributes correct
- [ ] Focus order logical & visible
- [ ] Keyboard-only flows succeed

### Performance (profiled; mobile; 4× CPU; 4G)

- FCP: <value> s | LCP: <value> s | CLS: <value> | TBT: <value> ms
- Budgets met: [ ] Yes [ ] No (notes)

### Device Emulation

- [ ] Mobile (≈375px) [ ] Tablet (≈768px) [ ] Desktop (≥1280px)

## Test Outcomes

- [x] Unit / integration subset (vitest `pnpm test -- --runInBand --grep capacity`)
- [ ] Error handling paths
- [ ] A11y (axe) if UI changes

### Test results (2025-11-30)

- Command: `pnpm test -- --runInBand --grep capacity`
- Status: **failed** (13 files / 15 tests failing). Key failures:
  - `tests/server/capacity/supabase-table-assignment.test.ts`: ManualSelectionInputError "Failed to load table inventory" (likely fixture/mock data issue).
  - `src/app/api/auth/callback/route.test.ts`: session data undefined in mock leading to 500, warning expectation mismatch.
  - `src/app/api/ops/occasions/route.test.ts`: mock for `getServiceSupabaseClient` missing.
  - Several UI tests missing testing-library jest-dom matchers (`toBeDisabled`, `toBeInTheDocument`, `toHaveAttribute`).
  - Feature-flag safety warning logged when holds.strictConflicts disabled in test env.

## Artifacts

- Lighthouse / HAR / traces (if UI work): `artifacts/`
- DB diff (if any): `artifacts/db-diff.txt`

## Known Issues

- [ ] <issue> (owner, priority)

## Sign-off

- [ ] Engineering
- [ ] Design/PM (if UI)
- [ ] QA

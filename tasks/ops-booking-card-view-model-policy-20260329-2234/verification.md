---
task: ops-booking-card-view-model-policy
timestamp_utc: 2026-03-29T22:34:59Z
owner: github:@openai
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

Tool: Chrome DevTools MCP

### Console & Network

- [x] Existing `http://localhost:3000/dev/ops-bookings-list` and `/dev/ops-dashboard` harnesses were reachable and returned `200`.
- [ ] Branch-specific QA not completed: the live `localhost:3000` instance is from another checkout and showed stale behavior (`checked_in` card still displayed urgency), so it could not validate this diff.

### DOM & Accessibility

- [ ] Blocked for this worktree: a stale `.next/dev/lock` prevented starting a branch-local Next dev server on `3001`.

### Performance (profiled; mobile; 4× CPU; 4G)

- FCP: n/a | LCP: n/a | CLS: n/a | TBT: n/a
- Budgets met: [ ] Yes [ ] No
- Notes: not measured because the branch-local runtime could not be started for DevTools profiling.

### Device Emulation

- [ ] Not completed for this worktree runtime.

## Test Outcomes

- [x] `pnpm exec vitest run tests/components/OpsBookingCardViewModel.test.ts tests/components/features/bookings/opsBookingsSelectors.test.ts tests/components/OpsBookingCardActions.noShow.test.tsx`
- [x] `pnpm exec tsc --noEmit --pretty false`

## Artifacts

- Checks summary: `artifacts/checks.txt`
- DevTools notes: `artifacts/devtools-notes.md`

## Known Issues

- Branch-local Chrome DevTools validation remains blocked by local runtime state (`.next/dev/lock` plus a different checkout already bound to `localhost:3000`).

## Sign-off

- [ ] Engineering
- [ ] Design/PM
- [ ] QA

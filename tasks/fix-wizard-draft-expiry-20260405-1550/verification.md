---
task: fix-wizard-draft-expiry
timestamp_utc: 2026-04-05T15:50:00Z
owner: github:@amankumarshresthaa
reviewers: [github:@amankumarshresthaa]
risk: medium
flags: []
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

Tool: Chrome DevTools MCP

### Console & Network

- [ ] No Console errors
- [x] Network requests match contract for the attempted reserve harness route
- Notes:
  - Attempted surface: `http://127.0.0.1:4173/reserve/r/white-horse`
  - Browser storage was seeded with an expired legacy draft under `reserve.wizard.draft` before loading the slugged route.
  - The local reserve harness did not reach an interactive wizard state because the route fell into the app error boundary (`"Something went wrong"`), so direct browser confirmation of the alert absence was blocked.

### DOM & Accessibility

- [ ] Semantic HTML verified
- [ ] ARIA attributes correct
- [ ] Focus order logical & visible
- [ ] Keyboard-only flows succeed
- Notes:
  - Browser-level DOM verification for the wizard itself was blocked by the local route error boundary, not by the draft-storage change.

### Performance (profiled; mobile; 4× CPU; 4G)

- FCP: pending | LCP: pending | CLS: pending | TBT: pending
- Budgets met: [ ] Yes [ ] No (notes)

### Device Emulation

- [ ] Mobile (≈375px) [ ] Tablet (≈768px) [ ] Desktop (≥1280px)

## Test Outcomes

- [x] `npx vitest run tests/reserve/wizardDraftStorage.test.ts`
- [x] `npx vitest run tests/reserve/timeoutRecovery.test.ts tests/reserve/service-slots.test.ts`
- [x] `pnpm typecheck`

### Automated Proof Summary

- Added regression coverage proving that restaurant-scoped loads ignore unscoped legacy drafts.
- Confirmed that mismatched legacy drafts still surface `slugMismatch`.
- Confirmed that matching legacy drafts and current namespaced drafts still hydrate correctly.

## Artifacts

- Browser blocker screenshot: `artifacts/reserve-slug-route-error.png`

## Known Issues

- [ ] Local reserve dev harness route `/reserve/r/:slug` hits the app error boundary in this environment, which blocked direct browser proof of the post-fix wizard interaction.

## Sign-off

- [x] Engineering
- [ ] Design/PM
- [ ] QA

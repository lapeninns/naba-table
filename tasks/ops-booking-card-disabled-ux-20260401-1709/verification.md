---
task: ops-booking-card-disabled-ux
timestamp_utc: 2026-04-01T17:09:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

Tool: Chrome DevTools MCP

### Verification surface used

- Route: `http://127.0.0.1:3002/dev/ops-bookings`
- Why: existing public dev harness for ops bookings, no new harness needed

### Interaction verified

- Confirmed the ops bookings dev harness loads successfully.
- Confirmed a non-locked booking card still opens the overflow menu.
- Captured screenshot evidence of the open overflow menu:
  - `artifacts/ops-bookings-dev-harness-menu.png`

### Console & Network

- No console errors observed; only expected PostHog debug logs were present.
- Route document request returned `200`.

### Browser limitation / fallback

- The in-memory harness completes lifecycle mutations too quickly to hold a stable pending-state UI for screenshot capture.
- Compensating evidence:
  - focused component tests cover the exact locked pending state
  - row-level inert semantics are asserted in test
  - Details and overflow locking are asserted in test

## Automated Verification

```bash
npx vitest run tests/components/OpsBookingCard.test.tsx tests/components/OpsBookingCardActions.noShow.test.tsx
pnpm typecheck
```

- Result: passed

## Known Issues

- None for this patch.

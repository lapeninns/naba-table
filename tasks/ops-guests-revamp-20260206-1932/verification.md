---
task: ops-guests-revamp
timestamp_utc: 2026-02-06T19:32:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

Route tested: `http://localhost:3000/dev/ops-customers` (dev harness)

- [x] No console errors (logs only; PostHog debug + Fast Refresh)
- [x] KPI summary visible + updates with filters/search
- [x] Keyboard navigation focuses guest cards and action buttons
- [x] `?focus=cust-2` scrolls to and focuses the expected guest card
- [x] Virtualized scrolling remains smooth with dense cards

Notes:

- Dev harness uses in-memory services; Ops API network traces are not representative here.

Artifacts:

- Screenshots (Chrome DevTools MCP):
  - `artifacts/dev-ops-guests-desktop.png`
  - `artifacts/dev-ops-guests-tablet.png`
  - `artifacts/dev-ops-guests-mobile.png`
- Trace (Slow 4G + 4x CPU):
  - `artifacts/dev-ops-guests-trace-slow4g-cpu4.json.gz`

Performance highlights (from trace):

- LCP: 1.486 s
- CLS: 0.00

## Tests

- [x] `pnpm run typecheck`
- [x] `pnpm vitest run`
- [x] `pnpm playwright test tests/e2e/ops-guests-dev-harness.spec.ts`

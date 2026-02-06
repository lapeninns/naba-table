---
task: ops-guests-revamp
timestamp_utc: 2026-02-06T19:32:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Add shared thresholds in `lib/ops/customers.ts`.
- [x] Extend `OpsCustomersPage` to include optional `summary`.

## Backend

- [x] Extend `/api/ops/customers` response schema + handler to return `summary` (page 1 only).
- [x] Implement summary computation in `server/ops/customers.ts` with shared filter logic.
- [x] Update dev harness mock customer service to return `summary` on page 1.

## UI

- [x] Rename nav/page copy from Customers -> Guests.
- [x] Add Guests KPI summary component.
- [x] Add canonical guest card component with status rail + actions + tiles.
- [x] Refactor `CustomersTable` to render guest cards (remove duplicate card implementations).
- [x] Ensure `?focus=...` focuses a tabbable guest card.

## Verification

- [x] `pnpm run typecheck`
- [x] `pnpm vitest run`
- [x] `pnpm playwright test tests/e2e/ops-guests-dev-harness.spec.ts`
- [x] Chrome DevTools MCP manual QA + screenshots

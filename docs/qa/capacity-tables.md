# Capacity And Tables QA

Sprint 6 adds focused local API/unit and browser entrypoints for deterministic capacity, table assignment, table timeline, and shipped route coverage:

```sh
pnpm run qa:capacity-tables
```

The aggregate command runs:

- `pnpm run qa:capacity-tables:api`
- `pnpm run qa:capacity-tables:browser`

The API command selects:

- deterministic capacity policy and seatability tests.
- direct assignment and unassignment helper tests.
- ops table assignment route tests.
- ops table inventory security tests.
- ops table delete guard tests.
- ops table timeline route tests.
- a command-composition QA test so the selector stays intentional.

The browser command selects `tests/e2e/ops-capacity-tables.spec.ts`, which uses the local app-host auth fixture and mocked ops APIs to prove the shipped `/settings/restaurant/tables` route renders capacity and inventory state. It also verifies the legacy `/seating` and `/seating/floor-plan` routes redirect to the authenticated dashboard instead of exposing a stale surface.

This suite is local and mocked. It must not contact production or staging, create live bookings, or mutate live table inventory.

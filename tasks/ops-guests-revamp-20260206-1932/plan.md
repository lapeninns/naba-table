---
task: ops-guests-revamp
timestamp_utc: 2026-02-06T19:32:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Ops Guests Page (`/customers`)

## Objective

Revamp Ops Customers into a production-grade **Guests** experience:

- High-density, virtualized guest cards (single canonical component).
- KPI summary section (primary + collapsible secondary) that updates with filters/search.
- Extend `/api/ops/customers` to return `summary` (page 1 only), computed server-side.

## Success Criteria

- [ ] Sidebar/nav label is **Guests** (URL stays `/customers`).
- [ ] KPI tiles: Total, Returning (>=2), VIP (>=5), Opted-in; More: Opted-out, Never visited.
- [ ] KPIs reflect the current filtered result set.
- [ ] Scroll + virtualization remain smooth with large lists.
- [ ] `?focus=...` scrolls to and focuses a guest card (tabbable).
- [ ] Summary failures do not break list rendering.

## Primary Files

- UI:
  - `/Users/amankumarshrestha/LapenInns Project/SajiloReserveX/src/components/features/customers/OpsCustomersClient.tsx`
  - `/Users/amankumarshrestha/LapenInns Project/SajiloReserveX/src/components/features/customers/CustomersTable.tsx`
  - New: `/Users/amankumarshrestha/LapenInns Project/SajiloReserveX/src/components/features/customers/OpsGuestCard.tsx`
  - New: `/Users/amankumarshrestha/LapenInns Project/SajiloReserveX/src/components/features/customers/GuestsSummaryMetrics.tsx`
- API:
  - `/Users/amankumarshrestha/LapenInns Project/SajiloReserveX/src/app/api/ops/customers/route.ts`
  - `/Users/amankumarshrestha/LapenInns Project/SajiloReserveX/src/app/api/ops/customers/schema.ts`
- Server:
  - `/Users/amankumarshrestha/LapenInns Project/SajiloReserveX/server/ops/customers.ts`
  - New thresholds: `/Users/amankumarshrestha/LapenInns Project/SajiloReserveX/lib/ops/customers.ts`

## Tests

- Unit/UI: `pnpm vitest run`
- Typecheck: `pnpm run typecheck`
- E2E smoke (dev harness): `pnpm playwright test tests/e2e/ops-guests-dev-harness.spec.ts`

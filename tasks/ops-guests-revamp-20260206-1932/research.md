---
task: ops-guests-revamp
timestamp_utc: 2026-02-06T19:32:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Ops Guests Page Revamp

## Requirements

- Replace Ops `/customers` UI wording to **Guests** (URL stays `/customers`).
- Add KPI summary tiles that update with filters/search.
- Keep infinite scrolling + virtualization.
- Backend returns `summary` payload on page 1 only (computed server-side).
- Failure mode: list loads even if summary computation fails.

## Existing Patterns & Reuse

- Existing customers list: `/Users/amankumarshrestha/LapenInns Project/SajiloReserveX/src/components/features/customers/OpsCustomersClient.tsx`
- Virtualization already implemented in `/Users/amankumarshrestha/LapenInns Project/SajiloReserveX/src/components/features/customers/CustomersTable.tsx`
- Dashboard metric tiles patterns: `/Users/amankumarshrestha/LapenInns Project/SajiloReserveX/src/components/features/dashboard/SummaryMetrics.tsx`
- Dev harness: `/Users/amankumarshrestha/LapenInns Project/SajiloReserveX/src/app/(public)/dev/ops-customers/page.tsx`

## Constraints & Risks

- Must not add DB migrations.
- Must not degrade scroll perf on large guest lists.
- Must keep focus deep-link (`?focus=...`) working with virtualization.

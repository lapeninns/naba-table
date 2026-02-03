---
task: ops-customers-optimization
timestamp_utc: 2026-02-02T22:45:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Ops Customers Performance

## Requirements

- Apply virtualization + infinite scrolling to `/app/customers`.
- Preserve filters, search, and export behavior.
- API caps page size at 50.

## Existing Patterns & Reuse

- Ops bookings infinite list + virtualization for reference.
- Customers list uses `useOpsCustomers` and `CustomersTable` with pagination.

## Constraints & Risks

- Ensure filter/query params remain consistent (remove `page` param when pagination removed).
- Maintain a11y and focus behavior for `focusCustomer`.

## Recommended Direction

- Convert `useOpsCustomers` to `useInfiniteQuery` with pageSize=50.
- Remove pagination UI and use window virtualization in `CustomersTable`.

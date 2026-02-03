---
task: ops-customers-optimization
timestamp_utc: 2026-02-02T22:45:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Ops Customers Performance

## Objective

Replace pagination with infinite scrolling and virtualized rendering in `/app/customers` while keeping filters and export behavior intact.

## Success Criteria

- [ ] Pagination UI removed; list scrolls continuously with on-demand loading.
- [ ] Filters/search/export remain correct and responsive.
- [ ] Focus behavior for `focusCustomer` still works.

## Components

- `src/components/features/customers/OpsCustomersClient.tsx`
- `src/components/features/customers/CustomersTable.tsx`
- `hooks/useOpsCustomers.ts`

## Testing Strategy

- `pnpm run typecheck`.
- DevTools MCP when env vars are available.

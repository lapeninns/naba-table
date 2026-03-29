---
task: ops-customers-performance-pass
timestamp_utc: 2026-03-29T17:19:25Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Ops Customers Performance Pass

## Objective

We will simplify the guests page architecture so operator filtering and scrolling stay behaviorally identical while reducing page-wide rerenders and repeated guest-card derivation.

## Success Criteria

- [ ] `OpsCustomersClient` becomes a thinner composition shell with query-state and data-state responsibilities separated.
- [ ] Guest-card presentation values are precomputed before the table render path.
- [ ] `CustomersTable` keeps virtualization, infinite loading, and focus behavior unchanged.
- [ ] URL filter syncing remains shareable/bookmarkable without redundant churn.
- [ ] Targeted tests cover selectors/helpers and changed component behavior.

## Architecture & Components

- `useOpsCustomersQueryState`
  - Owns URL parsing, local filter state, debounced search, clear/reset flows, and router synchronization.
- `useOpsCustomersDataState`
  - Owns query invocation, page flattening, summary extraction, refresh/load-more state, and export filter shaping.
- `opsCustomersSelectors`
  - Owns guest-card row model derivation and active-filter badge shaping.
- `OpsCustomersClient`
  - Thin composition shell wiring the toolbar, summary, table, and empty/error states.
- `CustomersTable`
  - Receives guest row models instead of raw `OpsCustomer` records.
- `OpsGuestCard`
  - Renders a precomputed guest row model and keeps only minimal presentation logic.

## Data Flow & API Contracts

- Existing API remains unchanged:
  - `GET /api/ops/customers`
- Existing hook/service contracts remain canonical:
  - [`hooks/useOpsCustomers.ts`](/Users/amankumarshrestha/.codex/worktrees/1d2c/nabatableLP/hooks/useOpsCustomers.ts)
  - [`src/services/ops/customers.ts`](/Users/amankumarshrestha/.codex/worktrees/1d2c/nabatableLP/src/services/ops/customers.ts)
- New internal contract:
  - `OpsGuestRowViewModel`
    - stable per-row display data for `CustomersTable` and `OpsGuestCard`

## UI / UX States

- Preserve:
  - loading skeleton
  - empty state
  - destructive error alert with retry
  - filter badges and clear behavior
  - deep-link focus to customer card
  - infinite scrolling load-more sentinel

## Edge Cases

- Offline mode should still avoid router query updates.
- Focus can target either customer id or email and must survive virtualization.
- Empty search should remove the query-string key.
- Clearing filters should restore default sort/filter values without changing behavior.

## Testing Strategy

- Unit:
  - selector/view-model tests for guest-row formatting and badge shaping
- Component:
  - `CustomersTable` rendering/focus/load-more behavior with view models
  - `OpsCustomersClient` filter/query behavior where practical
- Validation:
  - targeted `vitest`
  - targeted `eslint`
  - targeted `tsc --noEmit`
  - Chrome DevTools MCP on `/dev/ops-customers`

## Rollout

- No feature flag needed; this is an internal structural refactor.
- Risk is limited to the guests page shell and guest-card rendering path.
- Fallback is to revert this isolated customers pass if a regression appears.

## Scope Boundaries

- In scope:
  - customers page shell
  - customers table / guest card render path
  - page-local hooks/selectors/tests
- Out of scope:
  - API contract changes
  - visual redesign
  - broader operator-shell or export-route changes
  - any Cloudflare/email production flow

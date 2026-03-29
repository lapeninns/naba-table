---
task: ops-customers-performance-pass
timestamp_utc: 2026-03-29T17:19:25Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Ops Customers Performance Pass

## Requirements

- Functional:
  - Preserve the current guests page behavior for operator workflows.
  - Keep URL-shareable filters, focus targeting, infinite loading, exporting, and dev-harness verification intact.
  - Keep the current `/app/customers` route and dev harness behavior unchanged.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Reduce unnecessary rerenders on filter updates and large guest lists.
  - Keep keyboard focus behavior for `focus` deep links intact.
  - Avoid broad client coordination in the page shell.
  - Preserve API contracts and avoid any new data-access duplication.

## Existing Patterns & Reuse

- The dashboard and recent email-delivery/bookings refactors are the quality bar:
  - thin composition shell
  - split query/data/action responsibilities
  - precomputed view models before heavy tables/lists
- Existing customers structure:
  - [`src/components/features/customers/OpsCustomersClient.tsx`](/Users/amankumarshrestha/.codex/worktrees/1d2c/nabatableLP/src/components/features/customers/OpsCustomersClient.tsx)
    - owns URL parsing, local mirrored filter state, query syncing, toolbar UI, badge derivation, and query wiring
  - [`src/components/features/customers/CustomersTable.tsx`](/Users/amankumarshrestha/.codex/worktrees/1d2c/nabatableLP/src/components/features/customers/CustomersTable.tsx)
    - owns virtualization, focus retry, and infinite-load threshold behavior
  - [`src/components/features/customers/OpsGuestCard.tsx`](/Users/amankumarshrestha/.codex/worktrees/1d2c/nabatableLP/src/components/features/customers/OpsGuestCard.tsx)
    - computes rail state, initials, formatted last-visit labels, primary contact selection, and action labels during render
  - [`hooks/useOpsCustomers.ts`](/Users/amankumarshrestha/.codex/worktrees/1d2c/nabatableLP/hooks/useOpsCustomers.ts)
    - already a relatively focused query hook; best reused rather than replaced

## Current Architecture

- Route [`src/app/app/(app)/customers/page.tsx`](</Users/amankumarshrestha/.codex/worktrees/1d2c/nabatableLP/src/app/app/(app)/customers/page.tsx>) resolves `focus` from `searchParams` and hands off to a client page.
- Client page parses filter/search params into local state, then re-syncs those values back to the URL in an effect after debouncing search.
- The customer query hook returns paginated pages; the page flattens pages into raw `OpsCustomer[]`.
- The table virtualizes guest cards, but each rendered card still derives presentation state on the hot path.

## Bottlenecks & Rerender Hotspots

- `OpsCustomersClient` recreates and re-renders a broad surface on every filter change:
  - query parsing
  - local state synchronization effect
  - active badge derivation
  - export filter shaping
  - summary/table prop shaping
- `CustomersTable` receives raw customers instead of pre-shaped card models, so row rendering redoes customer presentation work repeatedly.
- `OpsGuestCard` performs several per-card computations during render:
  - badge state and rail state
  - initials
  - phone normalization
  - last-visit absolute/relative formatting
  - email/call labels
- Query-string syncing currently depends on page-level effect churn instead of a narrower query-state owner.

## Bundle / Hydration / Runtime Concerns

- The customers route is fully client-owned even though most of the client work is state coordination rather than direct interaction.
- The dev harness already exists and should stay the verification path.
- No duplicate browser Supabase clients were found in the customers flow.

## Best Candidate Pages Ranked by Impact

1. Customers page
   - The page shell is the highest-value target because it mixes query state, data ownership, and render composition.
   - The guest-card presentation layer is the next hotspot because it repeats row-level derivation during visible-row rendering.
2. Customers table/guest card
   - Keep virtualization/focus behavior intact, but feed it precomputed guest row models.

## Recommended Direction (with rationale)

- Introduce a dedicated customers query-state hook that owns:
  - parsing search params
  - canonical filter state
  - debounced search
  - precise router sync
- Add selector/view-model helpers that convert `OpsCustomer` rows into guest-card models once per dataset update.
- Keep [`hooks/useOpsCustomers.ts`](/Users/amankumarshrestha/.codex/worktrees/1d2c/nabatableLP/hooks/useOpsCustomers.ts) as the canonical data hook and wrap it from a page-local data-state hook instead of duplicating query logic.
- Keep the page shell focused on composition, passing:
  - summary state
  - toolbar callbacks
  - precomputed guest rows
  - load-more/focus props

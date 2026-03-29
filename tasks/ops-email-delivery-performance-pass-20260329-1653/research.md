---
task: ops-email-delivery-performance-pass
timestamp_utc: 2026-03-29T16:53:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Ops Email Delivery Performance Pass

## Requirements

- Functional:
  - Preserve current operator workflows on the email delivery page, including tab navigation, filters, pagination, retry flows, queue monitoring, and analytics.
  - Preserve current dev harness behavior for `/dev/ops-email-delivery`.
  - Avoid regressions to production email sending and Cloudflare-backed production behavior.
- Non-functional:
  - Reduce unnecessary rerenders and repeated render-time derivation.
  - Narrow client-side state ownership and keep inactive areas as isolated as possible.
  - Improve maintainability by splitting mixed responsibilities into smaller hooks/selectors.
  - Preserve accessibility, keyboard support, and current URL/bookmark semantics.

## Existing Patterns & Reuse

- Dashboard and bookings now follow the preferred pattern:
  - narrow page shell
  - query-state hook
  - data-state hook
  - dialog/action hook
  - precomputed row/view models
- `src/components/features/email-delivery/OpsEmailDeliveryClient.tsx` currently does not follow that pattern and is the clearest remaining operator-page outlier.
- Existing tests already cover:
  - `tests/components/OpsEmailDeliveryClient.test.tsx`
  - `tests/components/OpsEmailDeliveryTable.test.tsx`
  - `tests/components/OpsEmailDeliveryFilterBar.test.tsx`
  - `tests/components/OpsEmailDeliveryAnalytics.test.tsx`
  - `tests/e2e/ops-email-delivery-dev-harness.spec.ts`

## Current Architecture

- `OpsEmailDeliveryClient.tsx` is a 1243-line client component that currently owns:
  - route/query parsing
  - mirrored local filter state
  - URL synchronization
  - tab state
  - restaurant switch resets
  - feed query orchestration
  - analytics query orchestration
  - retry dialog/action flow
  - queue refresh coordination
  - pagination state
  - empty/error/loading presentation branching
- `OpsEmailDeliveryTable.tsx` receives raw attempts and performs row-level work in render:
  - subject derivation from events
  - message-key derivation
  - date parsing and sort values
  - retry eligibility checks
  - array copy + sort on every input/state change
- Query hooks are relatively focused, but the page shell is over-subscribed to too much state.

## Bottlenecks & Rerender Hotspots

- Monolithic client coordinator causes broad rerenders for changes that should stay local to:
  - filter/search state
  - retry dialog state
  - queue refresh state
  - analytics refresh state
- Query-string parsing is duplicated with local state mirroring and a sync-back effect.
- The delivery log table re-derives per-row subject/sort/display metadata on each render.
- Retry flow is object-driven rather than key-driven, causing broader prop fan-out than needed.
- URL synchronization currently uses `window.history.replaceState` directly instead of a narrower router-driven state transition.

## Bundle / Hydration / Runtime Concerns

- The main page shell is a large client boundary with heavy coordination logic.
- Delivery log, queue, and analytics are visually separated, but the main client still owns cross-tab orchestration in one place.
- Analytics query remains active under the same large client boundary even when the delivery log is the primary active tab.
- The existing surface appears functionally sound, but the architecture leaves less headroom for frequent operator filtering and larger delivery logs.

## Candidate Ranking

1. Email delivery page
   - Highest remaining structural payoff after the completed bookings pass.
   - Largest client coordinator among the priority targets reviewed so far.
2. Customers page
   - Likely next best fit for pre-shaped table/view models and narrower state ownership.
3. Floor plan / seating
   - Strong performance upside, but likely a riskier pass due to scene/render interaction coupling.
4. Walk-in wizard
   - Worth optimizing, but likely lower leverage than email/customers for operator throughput.

## Recommended Direction (with rationale)

- First split email delivery into smaller responsibilities without changing the public surface:
  - query-state hook
  - data-state hook
  - retry/action hook
  - precomputed table-row selectors
  - thin composition shell
- Keep queue and analytics tabs behaviorally stable, but reduce how much unrelated state causes the delivery log tree to rerender.
- Convert the delivery table to consume pre-shaped row models rather than raw attempts.
- Preserve all current retry, filter, pagination, and restaurant-switch behavior.

## Open Questions (owner, due)

- Q: Should analytics stay eagerly queried for parity, or be made cold-on-first-open in a later pass?
  A: Keep eager behavior in this pass for parity; reconsider only if profiling shows it is a meaningful cost. Owner: github:@amankumarshrestha, due: 2026-03-29.

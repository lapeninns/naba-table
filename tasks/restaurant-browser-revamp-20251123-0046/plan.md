---
task: restaurant-browser-revamp
timestamp_utc: 2025-11-23T00:46:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: RestaurantBrowser Revamp

## Objective

We will enable guests to browse and book restaurants more effectively by revamping the RestaurantBrowser experience with a mobile-first, higher-converting layout while keeping existing copy and data contracts intact.

## Success Criteria

- [ ] Mobile layout prioritizes content/CTA above the fold; desktop shows 2–3 columns without overflow.
- [ ] Filters removed; full list always displayed while preserving accurate counts and analytics events (list view, selection, empty, errors).
- [ ] Perf/a11y budgets from AGENTS.md met on Lighthouse mobile profile.

## Architecture & Components

- `RestaurantBrowser` (client): renders list, analytics, and state/status without filters.
- Header bar: count badge + status text (no filters) with mobile-friendly spacing.
- Results grid: `Card`-based list with CTA button; responsive columns; reserved media space to avoid CLS (no images yet).
- Status surfaces: skeletons, loading inline text, structured error/empty states with support mailto.

## Data Flow & API Contracts

Endpoint: listRestaurants (existing) — no changes planned yet
Request: `{}` (filters disabled)
Response: `RestaurantSummary[]` (id, name, slug, timezone, capacity)

## UI/UX States

- Loading / Empty / Error / Success
  - Loading: skeleton cards + aria-hidden grid.
  - Refreshing: small inline status text.
  - Error: alert panel with retry + support email.
  - Empty: supportive copy and support link.

## Edge Cases

- No restaurants returned initially → show empty state with support path.
- Network error → toast + alert state; retry resets error tracking.

## Testing Strategy

- Unit: capacity formatting, analytics triggers, retry handling.
- Integration: useRestaurants query with initialData, error path, empty path.
- E2E/visual: viewport mobile/desktop for header, grid layout; keyboard navigation through cards/CTAs.
- Accessibility: axe/aria labels, focus order, skip links.

## Rollout

- Feature flag: not used (filters removed globally); rollback by reverting component.
- Exposure: full
- Monitoring: TBD
- Kill-switch: revert commit

## DB Change Plan (if applicable)

- N/A (no DB changes expected)

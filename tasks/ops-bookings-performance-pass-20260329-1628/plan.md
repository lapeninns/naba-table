---
task: ops-bookings-performance-pass
timestamp_utc: 2026-03-29T16:28:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Ops bookings performance pass

## Objective

Improve the next highest-impact operator surface using the dashboard refactor as the quality bar, while preserving user-visible behavior.

## Success Criteria

- [ ] The chosen page has smaller client coordination boundaries than before.
- [ ] Repeated render-time derivation is materially reduced.
- [ ] Query/mutation behavior is more precise with less broad invalidation or churn.
- [ ] Existing behavior and operator workflows remain intact.

## Architecture & Components

- Audit bookings first, then confirm whether it remains the best first implementation target.
- Chosen implementation target: bookings.
- Separate bookings into:
- `useOpsBookingsQueryState` — URL/search/filter/date/window ownership
- `useOpsBookingsDataState` — list query, status summary, and derived booking data
- `useOpsBookingsState` — thin composition layer matching the dashboard pattern
- `useOpsBookingsDialogs` — keep as the dialog/action hook, but avoid duplicate focus-detail fetches
- `BookingsTable` — render precomputed rows instead of rebuilding them inline

## Data Flow & API Contracts

- Reuse existing ops booking list/service contracts.
- Prefer ID-driven selection and pre-shaped row/card models over passing full mutable objects through dialog/action surfaces.
- Add pure selectors:
- `deriveOpsBookingsData(...)` for DTO + lookup + label + initial snapshot shaping
- `buildOpsBookingsCardRows(...)` for precomputing `OpsBookingCardViewModel[]`

## UI/UX States

- Preserve current loading, empty, error, details, edit, cancel, and lifecycle action behavior.

## Edge Cases

- Date/table/time filters and focus params must remain bookmarkable/shareable.
- Infinite scroll/load-more behavior must remain stable.
- Offline/runtime cleanup must not regress current operator flows.

## Testing Strategy

- Targeted typecheck
- Targeted lint
- Targeted tests for any new selectors/view-model helpers/hooks
- Manual Chrome DevTools verification on changed UI paths

## Scope Boundaries

- Do not refactor email delivery/customers/floor plan/walk-in in this task.
- Do not change booking APIs or production email/Cloudflare paths.
- Do not redesign the bookings UI.

## Rollout

- No feature flag planned unless implementation risk grows during audit.
- Keep fallback simple: preserve existing services/contracts and avoid endpoint changes unless necessary.

## DB Change Plan (if applicable)

- No database changes planned.

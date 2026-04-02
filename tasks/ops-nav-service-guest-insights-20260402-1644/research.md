---
task: ops-nav-service-guest-insights
timestamp_utc: 2026-04-02T16:45:54Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: low
flags: []
related_tickets: []
---

# Research: Ops Navigation Service and Guest & Insights Split

## Requirements

- Functional:
  - Replace the current `Daily operations` grouping with two categories: `Service` and `Guest & Insights`.
  - Preserve the existing route destinations and item-level feature-flag behavior.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Keep navigation semantics unchanged beyond labels and grouping.
  - Avoid introducing regressions in sidebar active-state behavior.

## Existing Patterns & Reuse

- Ops sidebar sections are defined in `src/components/features/ops-shell/navigation.tsx`.
- Route matching is already centralized per nav item via each item's `match` callback.
- `Restaurant Settings` is already a separate section and should remain unchanged.

## External Resources

- None needed; this is an internal information architecture adjustment.

## Constraints & Risks

- Empty placeholder sections should not remain visible after the regrouping.
- `Rejections` is feature-flagged and must stay conditional.

## Open Questions (owner, due)

- None. The user specified the exact target category names and approved the grouping.

## Recommended Direction (with rationale)

- Update the sidebar source of truth in `navigation.tsx` to create:
  - `Service`: Dashboard, Bookings, New Bookings, Floor Plan
  - `Guest & Insights`: Guests, Email Delivery, Email Templates, Rejections
- This keeps the live-service workflow separate from communication and analysis without changing route structure.

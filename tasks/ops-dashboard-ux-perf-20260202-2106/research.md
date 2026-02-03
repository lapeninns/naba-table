---
task: ops-dashboard-ux-perf
timestamp_utc: 2026-02-02T21:06:50Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Ops Dashboard UI/UX Smoothness & Performance

## Requirements

- Functional:
  - Keep ops dashboard behavior unchanged (filters, sorting, booking actions, dialogs, date navigation).
  - Maintain a11y and keyboard navigation.
- Non-functional:
  - Reduce render churn during list interactions (search/filter/sort).
  - Smooth per-minute updates without unnecessary re-renders.
  - Avoid new dependencies unless absolutely required.

## Existing Patterns & Reuse

- `useDeferredValue` already used to defer search filtering.
- `BookingsList` uses pagination and memoized filtering/sorting.
- Dialogs: `EditBookingDialog` is dynamically imported; `BookingDetailsDialogWrapper` is currently static import.

## External Resources

- Vercel React Best Practices (rerender-memo, rerender-dependencies, bundle-dynamic-imports).

## Constraints & Risks

- Chrome DevTools MCP required for UI verification (blocked by missing env vars).
- Avoid changes that alter list ordering or action availability.

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- Stabilize `now` prop passed to cards to leverage memoization (avoid new Date per render).
- Combine guest stats and tab counts into a single pass over bookings to reduce repeated O(n) work.
- Dynamically import `BookingDetailsDialogWrapper` to cut initial bundle/paint work.

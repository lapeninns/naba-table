---
task: fix-ops-dashboard-cancel
timestamp_utc: 2026-02-03T17:33:24Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Ops Dashboard Cancel Button

## Requirements

- Functional:
  - Ops dashboard cancel action should trigger booking cancellation flow.
  - Cancellation should update list/detail state and show feedback.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Preserve existing a11y behaviors in action menus/dialogs.
  - No new perf regressions; reuse existing hooks and APIs.
  - Ensure cancellation respects existing auth/tenant boundaries (no new access paths).

## Existing Patterns & Reuse

- Ops cancellation mutation: `src/hooks/ops/useOpsCancelBooking.ts`.
- Ops booking UI actions: `components/dashboard/OpsBookingCard.tsx`, `src/components/features/bookings/BookingsTable` (uses `onCancel`).
- Ops booking detail dialog with cancel affordance: `src/components/features/dashboard/booking-details/BookingDialog.tsx` (uses `onCancel`).
- Ops dashboard list flow: `src/components/features/dashboard/BookingsList.tsx` + `DashboardSummaryCard` + `OpsDashboardClient`.

## External Resources

- N/A (internal wiring fix).

## Constraints & Risks

- Must follow SDLC phases; no coding before plan.
- UI change requires Chrome DevTools MCP QA artifacts.

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- Fix `onCancel` wiring to trigger the ops cancellation mutation directly from the list, with a confirmation dialog using existing shadcn `AlertDialog` primitives.
- Rationale: `onCancel` currently opens the details dialog (`handleDetails`) instead of cancelling, which is perceived as non-functional.

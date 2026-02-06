---
task: ops-booking-dialog-redesign
timestamp_utc: 2026-02-06T01:16:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Ops Booking Dialog Redesign

## Requirements

- Functional:
  - Booking details dialog must support lifecycle actions (check-in/out, no-show, cancel) and table assignment.
  - Mobile must keep the current collapsible IA for Table Assignment, but make it discoverable when action is required.
- Non-functional:
  - Accessibility: keyboard navigation, semantic grouping for fit filters, aria-live announcements for async actions.
  - Maintainability: refactor large components into subcomponents and keep files under repo caps.
  - Consistency: unify cancellation confirmation UI and copy across Ops entry points.
  - Motion: respect `prefers-reduced-motion` for transitions and scrolling.
  - Performance: virtualize large table grids and reduce offscreen work to keep the dialog smooth.

## Existing Patterns & Reuse

- Dialog/Sheet primitives are shadcn (Radix) via `components/ui/*`.
- Existing global shortcut hook: `src/hooks/useGlobalShortcuts.ts`.
- Existing offline banner component: `src/components/features/booking-state-machine/BookingOfflineBanner.tsx`.
- Existing virtualization dependency: `@tanstack/react-virtual` (used in Ops list virtualizers).

## What Exists (Inventory)

- Booking dialog shell: `src/components/features/dashboard/booking-details/BookingDialog.tsx`
- Header: `src/components/features/dashboard/booking-details/components/DialogHeader.tsx`
- Guest panel: `src/components/features/dashboard/booking-details/components/GuestProfilePanel.tsx`
- Table assignment: `src/components/features/dashboard/booking-details/components/TableAssignmentPanel.tsx`
- Table card: `src/components/features/dashboard/booking-details/components/SelectableTableCard.tsx`
- Wrapper & entry points:
  - `src/components/features/bookings/BookingDetailsDialogWrapper.tsx`
  - `src/components/features/bookings/OpsBookingsClient.tsx`
  - `src/components/features/dashboard/OpsDashboardDialogs.tsx`

## Reviewer Feedback (Summary)

- Guest profile panel is too large and mixes too many concerns (cognitive load).
- Mobile table assignment is less discoverable due to collapsible.
- Gradients/badges/visual accents compete and create noise.
- Fit filters should be more accessible and touch-friendly.
- Add aria-live announcements for async actions.
- Keyboard shortcuts must be scoped and not interfere with typing/nested dialogs.
- Safe-area and mobile height should be robust.
- Cancellation confirmation is duplicated across surfaces; unify.

## Recommended Direction

Implement the agreed plan:

- Fix global shortcut semantics.
- Improve mobile discoverability for table assignment.
- Refactor GuestProfilePanel and TableAssignmentPanel into smaller components.
- Reduce gradients and standardize spacing/typography.
- Add a shared Ops cancellation alert dialog.
- Add tests + DevTools MCP QA artifacts.

## Addendum — Table Assignment Eligibility Policy

- Enforce table assignment eligibility by status + date (today/future) on both client and server.
- Block assignment for `completed`, `cancelled`, and `no_show` bookings.
- Single source of truth in `lib/ops/table-assignment-policy.ts`.

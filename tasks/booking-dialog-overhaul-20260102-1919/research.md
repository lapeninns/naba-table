---
task: booking-dialog-overhaul
timestamp_utc: 2026-01-02T19:19:13Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Booking Details Dialog UX/UI Overhaul

## Requirements

- Functional:
  - Split `BookingDialog` into `DialogHeader`, `GuestProfilePanel`, and `TableAssignmentPanel`.
  - Status-based header styling: checked_in -> emerald, late -> rose, confirmed -> blue.
  - Responsive layout: stack guest + table panels on <768px, side-by-side on desktop.
  - Keyboard shortcuts: Cmd/Ctrl+Enter triggers primary action; Esc closes dialog; only when open.
  - WhatsApp action for guest phone (wa.me link with digits-only format); keep tel: behavior.
  - Smart Assign (client-only): pick available table with capacity >= party size, lowest capacity.
  - Conflict indicator on table cards when table.status === 'conflicted' with timeline bar.
  - Filters: Available-only and Perfect-fit (capacity === partySize or partySize + 1).
- Non-functional (a11y, perf, security, i18n):
  - Preserve keyboard navigation, focus states, and semantic structure.
  - No backend changes; only existing data (OpsTodayBooking, AssignmentContext).
  - Avoid console errors; degrade gracefully when optional data is missing.

## Existing Patterns & Reuse

- `src/components/features/dashboard/booking-details/BookingDialog.tsx` (main layout and actions).
- `src/components/features/dashboard/booking-details/components/` (Status badge, table card, panels).
- `src/components/features/dashboard/booking-details/hooks/useTableAssignment.ts` (table data + suggestions).
- `src/hooks/useGlobalShortcuts.ts` (keyboard shortcut handling).
- `src/components/features/dashboard/booking-details/utils.ts` (status + capacity helpers).

## External Resources

- None.

## Constraints & Risks

- Ops booking data does not expose `guest.tags`; use `loyaltyTier`, `allergies`, and `dietaryRestrictions` as tags.
- Smart assign is advisory only; avoid auto-applying assignment.
- Conflict visualization must use available times only; service window may be missing.

## Open Questions (owner, due)

- Confirm service window fallback for conflict timeline (default 18:00-22:00?) — owner: github:@amanshresthaa, due: 2026-01-02.
- Confirm whether `BookingAssignmentTabContent` should be replaced by `TableAssignmentPanel` — owner: github:@amanshresthaa, due: 2026-01-02.

## Recommended Direction (with rationale)

- Reuse existing booking-details components and hook; refactor `BookingDialog` into smaller components for readability and targeted re-renders.
- Implement new filters and smart-assign in `TableAssignmentPanel` to avoid duplicating table logic.
- Use `useGlobalShortcuts` for keyboard handling scoped to dialog open state.

---
task: booking-details-revamp
timestamp_utc: 2025-12-28T14:29:58Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Booking Details Revamp

## Objective

Enable staff to understand and act on a booking in 2–3 seconds with clear status, time, covers, and safe table assignment controls.

## Success Criteria

- [ ] Booking dialog renders with required sections and responsive layout.
- [ ] Table assignment flow shows suggestions, conflicts, and confirmation step.
- [ ] Loading, empty, and error states are explicit and accessible.
- [ ] Unit tests for utils + hook validation; component smoke tests for dialog states.
- [ ] Chrome DevTools MCP QA performed with artifacts and perf/a11y notes.

## Architecture & Components

- `BookingDialog.tsx`: orchestrator; uses Sheet on mobile and Dialog on desktop; controls open state, layout, loading/error states.
- `components/ArrivalCountdown.tsx`: time-to-arrival with severity states.
- `components/BookingStatCard.tsx`: stat tile component (compact + normal).
- `components/BookingStatusBadge.tsx`: status mapping + badge rendering.
- `components/ClickToCopy.tsx`: generic copy control with tooltip + toast.
- `components/ContactInfoRow.tsx`: phone/email row with action + copy.
- `components/SelectableTableCard.tsx`: table option card with selection state.
- `components/TableAssignmentPanel.tsx`: assignment UI, filtering, warnings, confirmation.
- `hooks/useTableAssignment.ts`: selection state, suggestions, validation, apply handler.
- `types.ts` + `utils.ts`: local domain types and shared helpers.

## Data Flow & API Contracts

- Component props take `OpsTodayBooking` + ops summary inputs from dashboard wrapper.
- Booking time values are ISO strings in types; utilities normalize to `Date` for countdowns and comparisons.
- Table actions delegate to provided callbacks from ops hooks (assign/unassign).
- `useTableAssignment` returns `apply()` status for UI.

## UI/UX States

- Loading: skeletons for header/stats/table list.
- Empty: “No tables available” with suggested actions.
- Error: Alert with message and retry CTA if supplied.

## Layout Notes

- Mobile-first: Sheet (bottom) with tabs/accordion and sticky actions.
- Desktop: Dialog with two-column layout and sticky footer actions.

## Edge Cases

- Booking time already passed (overdue state).
- Party size > available table capacity (warnings + multi-table suggestion).
- No contact info available.
- Table assignments disabled (read-only mode).

## Testing Strategy

- Unit: `utils.ts` time/capacity helpers; `useTableAssignment` validation.
- Component: `BookingDialog` renders loading/error/success states.
- A11y: keyboard navigation verified in manual QA.

## Rollout

- No feature flag unless requested; use existing dashboard entry points.
- Verify in staging/dev environment via manual QA.
- Document findings in `verification.md`.

## DB Change Plan (if applicable)

- Not applicable (UI-only).

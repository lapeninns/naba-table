---
task: booking-details-implementation
timestamp_utc: 2025-12-01T22:38:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Booking Details Component

## Requirements

- Functional:
  - Implement/reuse backend + frontend to power `src/components/features/dashboard/booking-details`.
  - Supabase-backed booking details retrieval (read) and update actions if existing contracts support them.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Adhere to repo a11y baseline; visible focus states; keyboard support.
  - Perf budgets per root AGENTS (LCP ≤2.5s, TBT ≤200ms on mobile profile).
  - Do not expose secrets; follow Supabase remote-only rule.

## Existing Patterns & Reuse

- Booking services: `src/services/ops/bookings.ts` already provides lifecycle mutations (check-in/out, no-show, undo), table assignment helpers (`assignTablesDirect`, `unassignTablesDirect`) and detail fetch via `getBooking` (REST `/api/ops/bookings/:id`).
- Hooks: `useOpsBooking` wraps `getBooking`; `useOpsBookingLifecycleActions` orchestrates lifecycle mutations with optimistic updates; `useOpsTableAssignmentActions` wraps legacy table assign/unassign endpoints. `useAssignmentContext` fetches assignment context but currently uses a raw `fetch` instead of the booking service.
- UI: `BookingDetailsDialogV2` expects `OpsTodayBooking` + summary props; `BookingAssignmentTabContent` uses `useAssignmentContext` + booking service direct assignment endpoints.
- API: `/api/ops/bookings/[id]` returns detailed booking with grouped `tableAssignments`, `startTime/endTime`, `reservationIntervalMinutes`, etc. `/api/ops/bookings/[id]/assignment-context` provides simplified floor-plan context for direct assignment.

## External Resources

- Supabase-backed REST endpoints above; no new schema changes required (reuse existing).

## Constraints & Risks

- Supabase remote-only; must avoid schema changes unless planned.
- Potential divergence between ops dashboard vs guest booking details.
- `useAssignmentContext` bypasses service layer → inconsistent error handling/caching; fix via service method.
- `BookingDetailsDialogWrapper` currently casts fetched data to `OpsTodayBooking` without normalization; risk of missing `startTime/endTime/tableAssignments` on first render.

## Open Questions (owner, due)

- (Resolved) Lifecycle + table assignment endpoints exist; use via booking service hooks.
- Need confirmation on gating table assignments for past dates—follow existing dashboard rule (allow only for today or future based on summary date/timezone).

## Recommended Direction (with rationale)

- Reuse existing ops services/hooks for bookings; avoid new primitives.
- Compose Booking Details component from existing UI primitives; add minimal new logic if needed.

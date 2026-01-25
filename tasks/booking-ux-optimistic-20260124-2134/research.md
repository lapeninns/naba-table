---
task: booking-ux-optimistic
timestamp_utc: 2026-01-24T21:34:48Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Booking UX + Optimistic Updates

## Requirements

- Functional: Remove long skeleton during Seat/Finish; make lifecycle updates feel instant.
- Functional: Smooth visual transitions for Seat/Finish and list updates on both ops dashboard and ops bookings.
- Functional: Exclude completed bookings from default/upcoming fetches on ops views.
- Non-functional: Maintain a11y (status updates announced), respect reduced-motion, keep brand tokens intact.

## Existing Patterns & Reuse

- Bookings list uses `components/dashboard/BookingsTable.tsx` + `OpsBookingCardSkeleton`.
- Ops lifecycle mutations are in `src/hooks/ops/useOpsBookingStatusActions.ts` (optimistic summary + state machine).
- Ops bookings list query uses `useOpsBookingsList` with `keepPreviousData`.

## External Resources

- N/A

## Constraints & Risks

- Must follow AGENTS SDLC phases and task artifacts.
- Must avoid full list skeleton on refetch; use subtle update indicator instead.
- Brand constraints must remain unchanged (fonts/colors/tone).
- Risk: optimistic updates may need rollback on error to avoid stale UI.

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- Remove artificial delay in Seat/Finish handlers.
- Only show full skeleton on initial load; keep list visible on refetch.
- Add optimistic cache patching for ops bookings list + detail, with rollback on error.
- Tighten upcoming status filters to avoid completed items.
- Polish micro-interactions (hover, pending overlay, list reflow) using existing brand tokens and tailwind-animate; respect reduced-motion.

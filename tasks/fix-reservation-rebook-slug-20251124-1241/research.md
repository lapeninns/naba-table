---
task: fix-reservation-rebook-slug
timestamp_utc: 2025-11-24T12:41:07Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Fix reservation rebook slug

## Requirements

- Functional: Rebooking from reservation detail should link to the correct restaurant slug without TypeScript errors.
- Non-functional: Maintain existing UX; type safety in build.

## Existing Patterns & Reuse

- Reservation data typed via `reservation.schema` and normalized in `reservation/adapter.ts`.
- `ReservationDetailClient` already computes a `venue` fallback and uses `useReservation` for data.

## External Resources

- None required; all logic is in-repo.

## Constraints & Risks

- Reservation API currently selects only restaurant name; slug not available in client data.
- Need to avoid breaking other consumers of `Reservation` type and adapter.

## Open Questions (owner, due)

- None identified.

## Recommended Direction (with rationale)

- Extend reservation payload to include restaurant slug from Supabase join.
- Normalize slug in adapter and surface as optional field on `Reservation` type; use it in rebook CTA with venue fallback to preserve behavior even if slug missing.

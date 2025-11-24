---
task: booking-table-delete-404
timestamp_utc: 2025-11-24T16:40:38Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Booking table delete returns 404

## Requirements

- Functional: Staff users should be able to unassign a table from a booking via `DELETE /api/ops/bookings/{bookingId}/tables/{tableId}` without receiving 404.
- Non-functional (a11y, perf, security, privacy, i18n): Preserve existing auth/membership checks and idempotency behaviour; no schema changes.

## Existing Patterns & Reuse

- Routing conventions document mandates nested resources use `/api/ops/bookings/[id]/tables/[id]` (see `docs/routing-conventions.md`).
- The route handler for unassigning tables lives at `src/app/api/ops/bookings/[id]/tables/[tableId]/route.ts` and expects the `/api/ops/bookings/:id/tables/:tableId` path.
- Ops booking client (`src/services/ops/bookings.ts`) centralizes all booking-related fetches behind `OPS_BOOKINGS_BASE` and is used by `OpsServicesProvider`.

## External Resources

- [docs/routing-conventions.md](docs/routing-conventions.md) — defines the correct `/api/ops/bookings/[id]/tables/[id]` path.
- [route-map.json](route-map.json) — lists `/api/ops/bookings/:id/tables/:tableId` with source `api/ops/bookings/[id]/tables/[tableId]/route.ts`.

## Constraints & Risks

- Changing the base path in `src/services/ops/bookings.ts` will affect all ops booking calls (list, status updates, assignments); must ensure the ops API actually lives under `/api/ops/bookings` for all these routes.
- Need to avoid breaking any consumer that might still expect `/api/bookings` (likely public flow), though the ops service is only used inside ops contexts.
- Manual UI QA may be required because this affects user-facing ops dashboard behaviour.

## Open Questions (owner, due)

- Q: Are there any non-ops consumers reusing `createBookingService`? (Owner: dev; Due: before merge)

## Recommended Direction (with rationale)

- Align `OPS_BOOKINGS_BASE` in `src/services/ops/bookings.ts` to `/api/ops/bookings` to match documented + implemented routes, eliminating 404s for table unassign.
- Add/adjust tests or lightweight checks to ensure the unassign endpoint targets `/api/ops/bookings`.
- Verify by hitting the unassign path (or mocking fetchJson) and ensuring 2xx and correct payload; perform quick manual UI check in ops dashboard if feasible.

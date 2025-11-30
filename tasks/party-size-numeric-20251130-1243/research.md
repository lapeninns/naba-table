---
task: party-size-numeric
timestamp_utc: 2025-11-30T12:43:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Accept numeric party size inputs

## Requirements

- Ensure editing a booking's party size succeeds when the value is supplied as a numeric string from the client.
- Preserve existing validation bounds (minimum 1; retain MAX limits per surface).

## Existing Patterns & Reuse

- API schemas use Zod for request validation in both guest (`src/app/api/bookings/[id]/route.ts`) and ops (`src/app/api/ops/bookings/[id]/route.ts`) routes.
- Frontend dialogs already coerce to numbers via `z.coerce.number` in `components/dashboard/EditBookingDialog.tsx`, but API schemas expect `number` and reject numeric strings.

## External Resources

- N/A (internal validation only).

## Constraints & Risks

- Must not relax bounds (min stays 1; guest max stays `MAX_ONLINE_PARTY_SIZE`).
- Avoid regressions in time/date logic; only touch party size coercion.

## Open Questions

- None currently.

## Recommended Direction (with rationale)

- Change API schemas to use `z.coerce.number().int()` for `partySize` in both guest and ops update routes so numeric strings pass; no other behavior changes.

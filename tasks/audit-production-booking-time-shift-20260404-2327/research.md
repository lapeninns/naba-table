---
task: audit-production-booking-time-shift
timestamp_utc: 2026-04-04T23:27:00Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: medium
flags: []
related_tickets: []
---

# Research: Audit Production Booking Time Shift

## Requirements

- Identify bookings in production that were affected by the ops-admin BST timezone regression.
- Keep the investigation read-only and avoid exposing any secrets.

## Existing Patterns & Reuse

- The root-cause fix lives in `src/app/api/ops/bookings/[id]/route.ts`.
- Production audit evidence is available through `audit_logs`.
- `audit_logs.metadata.changes` captures before/after diffs for booking updates.

## Constraints & Risks

- Production does not expose a ready-made service-role URL in local env, so access must be assembled safely from Supabase management credentials.
- DB data cannot prove user intent for every explicit reschedule, so detection must distinguish confirmed historical bug signatures from ambiguous manual edits.

## Recommended Direction (with rationale)

- Use the Supabase management API to resolve the production project and service-role key without printing secrets.
- Query `audit_logs` for `booking.updated` events after the BST switchover (`2026-03-29T00:00:00Z`).
- Treat a `start_time` shift of exactly `-60 minutes` on the same booking date as the strongest production bug signature.
- Separately check whether any such rows were later corrected by a `+60 minute` update.

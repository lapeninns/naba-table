---
task: booking-table-delete-404
timestamp_utc: 2025-11-24T16:40:38Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Booking table delete returns 404

## Objective

Fix ops booking table unassignment so the client calls the implemented `/api/ops/bookings/{id}/tables/{tableId}` endpoint instead of hitting a nonexistent path.

## Success Criteria

- [ ] Ops booking client uses `/api/ops/bookings` base for table assignment/unassignment and related requests.
- [ ] DELETE unassign call returns success (no 404) in a manual/automated check.
- [ ] Unit test guards the expected unassign path to prevent regressions.

## Architecture & Components

- Update `OPS_BOOKINGS_BASE` in `src/services/ops/bookings.ts` to the ops route.
- Add a lightweight service test mocking `fetchJson` to assert the DELETE URL.

## Data Flow & API Contracts

Endpoint: DELETE `/api/ops/bookings/{bookingId}/tables/{tableId}`
Request: none (path params)
Response: `{ tableAssignments: [...] }` (unchanged)
Errors: { code, message } per existing handler (400/401/403/404/409/500)

## UI/UX States

- Loading / Empty / Error / Success

## Edge Cases

- Invalid UUID -> 400 (unchanged)
- Booking missing -> 404 (unchanged)
- Removing last table reverts booking to pending (existing rule)

## Testing Strategy

- Unit: mock `fetchJson` to assert unassign path is `/api/ops/bookings/.../tables/{tableId}`.
- Integration/E2E: rely on existing API coverage; no new flows added.
- Accessibility: N/A (no UI surface change), but do a quick ops UI sanity if possible.

## Rollout

- Feature flag: none (path correction)
- Exposure: full
- Monitoring: watch for new 4xx/5xx on `/api/ops/bookings`
- Kill-switch: revert change if unexpected impact

## DB Change Plan (if applicable)

- Not applicable (no DB schema changes)

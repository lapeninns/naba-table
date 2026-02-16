# Incident Timeline — ebrain@doctors.org.uk (Old Crown Girton)

## Booking

- Booking ID: `160681eb-ca50-4a52-90d3-4e4e2f12f3d2`
- Reference: `FP9SWA7D24`
- Date/time: `2026-02-15 12:30–13:45 UTC`
- Party size: `3`

## Evidence Timeline (UTC)

1. `2026-02-14T18:16:28.704Z` — Booking created in `pending` status (`audit_logs` `booking.created`).
2. `2026-02-14T18:16:30.665Z` — `auto_assign.quote`: no hold, reason `Insufficient filtered capacity`.
3. `2026-02-14T18:16:31.141Z` — `inline_auto_assign.no_hold`: reason `Insufficient filtered capacity`.
4. `2026-02-14T18:20:23.998Z` — Job retry quote still no hold, same reason (`planner_duration_ms=229932`).
5. `2026-02-14T18:20:45.035Z` — `auto_assign.failed` after one attempt.
6. `2026-02-14T18:22:33.619Z` — `auto_assign.summary`: `result=exhausted`, `maxAttempts=1`.
7. `2026-02-14T18:22:34.017Z` — Booking `details.pending_admin_notified_at` set.
8. `2026-02-15T11:48:27.228Z` — Manual table assignment logged (`booking_table_assignment.assigned`) to table id `dc0f39c9-9e7a-4cfd-a1d9-7070da40e88a` (table number `05`) by actor `b9afc366-0b44-48cc-af91-3a9062df9fd0` (`oldcrown@lapeninns.com`).
9. `2026-02-15T13:25:08.821Z` — Booking status changed `confirmed -> checked_in`.
10. `2026-02-15T17:13:15.693Z` — Booking status changed `checked_in -> completed`.
11. `2026-02-15T17:13:16.039Z` — Assignment unassigned (checkout cleanup), so current `booking_table_assignments` row count is `0`.

## Key conclusion

- The booking was **not auto-assigned** at creation due planner failure (`Insufficient filtered capacity`), but it **was manually assigned later** before service, and then auto-cleared on completion.

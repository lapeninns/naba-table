---
task: seed-today-after4-vrdi
timestamp_utc: 2026-02-11T13:21:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Plan

## Success Criteria

- [x] Create 40-50 synthetic bookings on `2026-02-11` with `start_time >= 16:00:00`.
- [x] All created rows include table assignments.
- [x] Verification confirms zero rows before 16:00 for today.

## Execution

1. Resolve restaurant and timezone.
2. Build per-table schedule and generate non-overlapping slots from 16:00 onward.
3. Insert `customers`, `bookings`, and `booking_table_assignments`.
4. Verify today totals and time-window constraints.

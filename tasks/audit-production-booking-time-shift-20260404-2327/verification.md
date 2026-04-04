---
task: audit-production-booking-time-shift
timestamp_utc: 2026-04-04T23:27:00Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: medium
flags: []
related_tickets: []
---

# Verification Report

## Production Audit

- Access path: Supabase management API -> production project `vrdiqfudmwydclqpydee` -> production service-role key -> read-only `audit_logs` / `bookings` queries.
- BST window audited from `2026-03-29T00:00:00Z` onward.

## Findings

- Confirmed historical production hit count: `1`
- Currently unresolved confirmed hit count: `0`

### Confirmed historical hit

- Booking reference: `GWKJNS56MV`
- Booking id: `fa7139d7-bc42-4006-8646-623ac26e9100`
- Restaurant: `The Old Crown Girton`
- Booking date: `2026-04-01`
- Customer: `Jayne Drake`
- Bug signature:
  - Audit `b4df09fb-71b9-4a52-bbcd-9644a5928caf` at `2026-03-31T19:01:59.205749+00:00`
  - `start_time` changed from `18:30:00` to `17:30:00`
  - `party_size` changed from `3` to `5`
  - `notes` changed from `null` to `""`
- Later correction:
  - Audit `bf015ef3-d2e1-4793-86ed-ca76f1999a8f` at `2026-03-31T19:27:27.622716+00:00`
  - `start_time` changed back from `17:30:00` to `18:30:00`

## Confidence Notes

- The confirmed hit list is intentionally conservative.
- Audit data can prove the bug cleanly when a booking shifts exactly `-60 minutes` without a booking-date change.
- Audit data cannot prove user intent for every explicit manual reschedule, so ambiguous schedule edits are not included in the confirmed list above.

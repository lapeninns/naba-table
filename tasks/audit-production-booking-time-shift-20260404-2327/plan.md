---
task: audit-production-booking-time-shift
timestamp_utc: 2026-04-04T23:27:00Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Audit Production Booking Time Shift

## Objective

We will produce a production-safe, read-only list of bookings that show the strongest available signature of the BST time-shift bug so support and ops can decide whether any repair is needed.

## Success Criteria

- [ ] Production access stays read-only.
- [ ] The report distinguishes confirmed historical hits from currently unresolved rows.
- [ ] The confidence limits of the query are explicit.

## Data Flow & Query Strategy

- Resolve production Supabase project ref via the management API.
- Resolve production service-role key via the management API.
- Query `audit_logs` for `booking.updated` after `2026-03-29T00:00:00Z`.
- Flag rows where `start_time` moved `-60 minutes`.
- Mark a booking as unresolved only if no later `+60 minute` correction exists.

## Verification Strategy

- Record the production result set and confidence notes in `verification.md`.
- No code or schema change is involved.

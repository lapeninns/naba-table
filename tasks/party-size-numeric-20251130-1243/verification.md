---
task: party-size-numeric
timestamp_utc: 2025-11-30T12:43:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Verification Report

## Manual QA

- [ ] PATCH `/api/ops/bookings/{id}` with `partySize: "5"` returns 200 and updates booking.
- [ ] PUT `/api/bookings/{id}` with `partySize: "5"` returns 200 and updates booking.
- [ ] Requests with non-numeric `partySize` still return 400.

## Tests

- [ ] Not run (manual only).

## Artifacts

- Pending.

## Known Issues

- None observed yet.

---
task: seed-oldcrown-staging-bookings
timestamp_utc: 2026-03-19T00:37:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm target restaurant id and staging project
- [x] Confirm reusable seed script

## Core

- [x] Seed past bookings
- [x] Seed present bookings
- [x] Seed future bookings
- [x] Verify inserted rows

## Notes

- Assumptions: “present” means bookings on today (`2026-03-19`), not literally “currently seated”.
- Deviations: Existing script uses deterministic synthetic customer identifiers and does not add cleanup tags.
- Verification note: the reusable generator hit existing unique-customer collisions for some deterministic phone numbers, so the actual inserted counts were lower than the requested `BOOKING_COUNT` on past/present runs.

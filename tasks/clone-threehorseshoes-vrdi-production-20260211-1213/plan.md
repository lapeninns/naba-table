---
task: clone-threehorseshoes-vrdi-production
timestamp_utc: 2026-02-11T12:13:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Plan: Apply Three Horseshoes setup on vrdi production

## Success Criteria

- [x] `three-horseshoes` exists on `vrdiqfudmwydclqpydee`.
- [x] Profile details match provided address/contact/map.
- [x] 15 future days seeded with 40-50 bookings/day.
- [x] `hello@threehorseshoes-pub.com` has `owner` membership.

## Steps

1. Clone source `the-railway-pub` with owner assignment.
2. Overwrite restaurant profile fields.
3. Seed synthetic bookings/customers/assignments.
4. Resolve auth user id and grant membership via `USER_ID` path.
5. Verify counts and membership on `vrdi`.

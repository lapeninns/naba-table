---
task: purge-three-horseshoes-bookings
timestamp_utc: 2026-02-12T12:00:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Implementation Checklist

- [x] Create canonical purge script (dry run default).
- [x] Run dry run and capture counts + restaurant id.
- [x] Run apply with correct project ref confirmations.
- [x] Re-run dry run to verify bookings count is 0.
- [x] Record dry-run command + outcomes in `verification.md`.

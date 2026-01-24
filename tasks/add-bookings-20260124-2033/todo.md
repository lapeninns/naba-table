---
task: add-bookings
timestamp_utc: 2026-01-24T20:33:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Core

- [x] Identify target restaurant id and timezone.
- [x] Inspect `public.bookings` schema for required fields.
- [x] Generate and insert 45 bookings for 2026-01-25.
- [x] Verify count and sample data.
- [x] Record rollback SQL.

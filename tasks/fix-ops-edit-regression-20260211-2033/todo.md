---
task: fix-ops-edit-regression
timestamp_utc: 2026-02-11T20:33:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Core

- [x] Update dashboard booking DTO datetime conversion to UTC ISO with timezone context.
- [x] Update ops PATCH schema to accept offset datetimes.

## Validation

- [x] Run project type checks.
- [ ] Manual verify ops edit from dashboard and bookings pages.

## Notes

- Keep API contract backward-compatible for existing `Z` payloads.

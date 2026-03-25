---
task: purge-amanshrestha-email-bookings
timestamp_utc: 2026-03-24T12:39:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm target environment and dry-run semantics with the user
- [x] Inspect existing booking preview/deletion tooling in the repo
- [x] Create task artifacts for this production data operation

## Core

- [x] Preview matching production bookings for the masked guest email
- [x] Delete dependent rows and bookings in production
- [x] Verify zero remaining bookings for the masked guest email

## Notes

- Assumptions: local production env file contained working service-role credentials; direct Postgres auth from the stored DB URL was not usable, so the delete path used Supabase service-role APIs instead.
- Deviations: used an inline admin flow because the repo has no existing hard-delete-by-email script.

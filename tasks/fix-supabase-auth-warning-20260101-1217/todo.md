---
task: fix-supabase-auth-warning
timestamp_utc: 2026-01-01T12:17:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Locate warning source (getSession/onAuthStateChange usage)

## Core

- [x] Replace with getUser where required
- [ ] Update any dependent logic/tests

## UI/UX

- [ ] N/A

## Tests

- [ ] Smoke sign-in/sign-out

## Notes

- Assumptions:
- Deviations:

## Batched Questions

- ...

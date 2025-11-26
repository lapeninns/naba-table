---
task: login-csrf-cookie-fix
timestamp_utc: 2025-11-26T21:20:00Z
owner: github:@amankumarshrestha
reviewers: []
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [ ] Confirm reusable patterns for CSRF and auth

## Core

- [x] Remove `ensureCsrfCookie` call/import from `/auth/signin`
- [x] Ensure ops login no longer references helper
- [ ] Ensure session resolution works without errors

## UI/UX

- [ ] Login page renders states without crashes

## Tests

- [ ] Manual dev check: `/auth/signin`, `/app/login`

## Notes

- Assumptions:
- Deviations:

## Batched Questions

- ...

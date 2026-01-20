---
task: fix-csrf-cookie-source
timestamp_utc: 2026-01-20T17:28:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Add shared CSRF cookie options helper in `lib/security/csrf.ts`.

## Core

- [x] Update `server/security/csrf.ts` to use shared helper.
- [x] Update `src/proxy.ts` to use shared helper.
- [x] Normalize browser CSRF cookie domain when token exists.

## UI/UX

- [ ] N/A

## Tests

- [ ] Manual sign-in smoke test (admin password).

## Notes

- Assumptions:
- Deviations:

## Batched Questions

- None.

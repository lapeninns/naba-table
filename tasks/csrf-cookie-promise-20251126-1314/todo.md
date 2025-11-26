---
task: csrf-cookie-promise
timestamp_utc: 2025-11-26T13:14:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Create task folder and docs.

## Core

- [x] Make `ensureCsrfCookie` async and await `cookies()`.
- [x] Update sign-in pages to await the helper.
- [x] Fix default restaurant resolution promise typing to satisfy TypeScript.
- [x] Update rate-limit identifier to derive IP from headers (no `req.ip`).

## UI/UX

- [ ] Confirm no visual regressions expected (server-only change).

## Tests

- [x] Run `pnpm run build`.

## Notes

- Assumptions: Only the two sign-in pages call the helper; other build errors may surface after fixes.
- Deviations: Added supabase typing fix and rate-limit IP retrieval adjustment discovered during build.

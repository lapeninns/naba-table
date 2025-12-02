---
task: magic-link-regression
timestamp_utc: 2025-12-02T19:25:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [ ] Confirm failing scenario on current branch
- [ ] Capture baseline logs/errors

## Core

- [ ] Identify regression between commit 43ee2e6 and HEAD
- [x] Identify regression between commit 43ee2e6 and HEAD
- [x] Apply minimal fix to restore magic link behavior
- [x] Ensure validation/error handling aligns with API contract

## UI/UX

- [ ] Verify auth flow UX remains unchanged

## Tests

- [x] Update/add tests covering magic link request and redirect
- [x] Run automated test suite (targeted)

## Notes

- Assumptions:
- Supabase redirect allow-list includes `http://localhost:3000/api/auth/callback`.
- Host header contains port in real requests; fallback to sanitized domain still required for untrusted hosts.
- Deviations:
- Adjusted `parseHostname` to use `req.nextUrl.host` when header missing and preserved full host (incl. port) for magic-link callback URL generation.

## Batched Questions

-

---
task: signout-stale-session
timestamp_utc: 2026-01-27T00:16:44Z
owner: github:@copilot
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Locate canonical sign-out route and client helper.

## Core

- [x] Make server sign-out idempotent for missing-session errors.
- [x] Always clear auth cookies server-side.
- [x] Make client sign-out idempotent for missing-session errors.

## Tests

- [x] Add targeted sign-out tests.
- [x] Run relevant test suites.

## Notes

- Assumptions:
- Missing-session errors should not block sign-out UX.

## Batched Questions

- None yet.

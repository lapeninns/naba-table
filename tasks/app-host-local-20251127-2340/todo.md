---
task: app-host-local
timestamp_utc: 2025-11-27T23:40:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Update middleware host allowlist to include `app.localhost.com` only when ROOT_DOMAIN is default.

## Core

- [x] Ensure WEB_HOSTS unaffected; avoid unintended prod changes.

## UI/UX

- [ ] N/A

## Tests

- [x] Add middleware test case for `app.localhost.com` when ROOT_DOMAIN=localhost.

## Notes

- Assumptions: prod domains remain unchanged; change is dev-focused.
- Deviations: none.

## Batched Questions

- None.

---
task: guest-recover-save-error
timestamp_utc: 2026-01-20T16:05:16Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm recovery link flow and identify API call used for saving changes.

## Core

- [ ] Ensure session recovery token is available to booking update API.
- [x] Fix recovery cookie domain handling to avoid dropped tokens on non-root hosts.
- [x] Avoid overwriting reservation cache with incompatible booking DTO after updates.

## UI/UX

- [ ] Verify error handling does not trigger global error page for recoverable failures.

## Tests

- [ ] Add/update tests if needed.

## Notes

- Assumptions:
- Deviations:

## Batched Questions

-

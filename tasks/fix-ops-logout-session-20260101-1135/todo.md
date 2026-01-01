---
task: fix-ops-logout-session
timestamp_utc: 2026-01-01T11:35:15Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Review ops logout flow and shared sign-out helpers.

## Core

- [x] Ensure ops logout clears server auth cookies (via `/api/auth/signout`).
- [x] Ensure client sign-out still runs to clear local state.

## UI/UX

- [ ] Confirm loading/disabled states remain accessible.

## Tests

- [ ] Manual QA via Chrome DevTools MCP (ops logout).

## Notes

- Assumptions: logout should redirect to `/auth/signin`.
- Deviations:

## Batched Questions

- Should customer logout also call `/api/auth/signout`? (confirm)

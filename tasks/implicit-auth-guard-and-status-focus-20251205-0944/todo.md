---
task: implicit-auth-guard-and-status-focus
timestamp_utc: 2025-12-05T09:44:00Z
owner: github:@ai-assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Review current `ImplicitAuthHandler` guard/reset logic.
- [x] Inspect `GuestStatus` focusability and focusStatus() usage.

## Core

- [x] Add reset/cleanup for `redirectInFlight` (and signature) after handling implicit auth.
- [x] Ensure cleanup also runs when component persists across routes.
- [x] Make `GuestStatus` focusable so `.focus()` works.

## UI/UX

- [ ] Verify focus lands on status alert after submit.
- [ ] Smoke repeated implicit login flow within one session.

## Tests

- [ ] Manual auth hash handling check.
- [ ] Manual a11y focus check.

Note: `pnpm test -- --filter implicit-auth` was run; suite failed due to pre-existing auth/ops test failures unrelated to this change (see verification).

## Notes

- Assumptions: Implicit handler remains centralized; no feature flag required.
- Deviations: MCP tooling unavailable; manual verification performed instead.

## Batched Questions

- None.

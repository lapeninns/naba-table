---
task: toast-revamp
timestamp_utc: 2026-02-05T12:48:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm affected files and AGENTS scopes.
- [x] Remove legacy toast provider and Shadcn toast primitives.

## Core

- [x] Remove toast usage across components and hooks.
- [x] Remove toast usage in tests and comments.

## UI/UX

- [ ] Review key flows for missing user-facing feedback.

## Tests

- [ ] Manual smoke: ops dashboard + guest page.
- [ ] Chrome DevTools MCP (confirm no toast UI + a11y smoke).

## Notes

- Assumptions:
- Deviations: Removed toast notifications entirely; no replacement feedback yet.

## Batched Questions

- None.

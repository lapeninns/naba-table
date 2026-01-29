---
task: code-quality-tooling
timestamp_utc: 2026-01-29T12:56:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm lint/tooling integration points.

## Core

- [x] Add ESLint naming/complexity rules (warn).
- [x] Add large-file guard script and wire into lint.

## UI/UX

- [x] N/A (no UI changes).

## Tests

- [x] Run `pnpm lint`.
- [x] Run `pnpm typecheck`.
- [x] Run `pnpm test`.

## Notes

- Assumptions:
- Deviations:

## Batched Questions

- None.

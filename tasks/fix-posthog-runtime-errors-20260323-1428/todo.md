---
task: fix-posthog-runtime-errors
timestamp_utc: 2026-03-23T14:33:34Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Review root and closest nested `AGENTS.md` files for touched areas.
- [x] Review existing PostHog audit findings and likely repo matches.

## Core

- [x] Harden reservation schedule payload normalization at the client boundary.
- [x] Guard ops restaurant switch search/display against nullish restaurant names.
- [x] Guard optimistic list cache writes against malformed cache payloads.

## UI/UX

- [x] Ensure the public booking page falls back to empty/unavailable states instead of crashing.

## Tests

- [x] Add schedule normalization regression test.
- [x] Add booking mutation cache-shape regression tests.
- [x] Run targeted Vitest coverage.
- [x] Run `pnpm run typecheck`.
- [x] Run Chrome DevTools MCP smoke verification on a public booking route.

## Notes

- Assumptions:
  - The active March booking-page crash is caused by a partial client payload or state shape, not a server-side route failure.
- Deviations:
  - None yet.

## Batched Questions

- None.

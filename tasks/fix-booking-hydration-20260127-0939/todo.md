---
task: fix-booking-hydration
timestamp_utc: 2026-01-27T09:39:49Z
owner: github:@codex
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: [90787006]
---

# Implementation Checklist

## Setup

- [x] Locate the canonical booking page render path and any nested AGENTS rules.
- [x] Identify non-deterministic SSR/CSR render differences.

## Core

- [x] Implement the canonical deterministic render fix.
- [x] Remove any duplicate/legacy render paths if encountered and safe.

## UI/UX

- [x] Preserve existing semantics and accessibility.
- [ ] Verify loading/empty/error/success states still behave as expected.

## Tests

- [x] Run targeted tests for the route/components/helpers.
- [x] Run lint/typecheck as available.
- [ ] Perform manual UI QA via Chrome DevTools MCP if UI is affected.

## Notes

- Assumptions:
- Hydration mismatch is caused by default-locale/timezone `Intl` and render-time `Date.now()` in client components.
- Deviations:
- `pnpm typecheck` failed due to stale `.next/types/validator.ts` references to missing route files (unrelated to this change).
- Chrome DevTools MCP booking route verification is blocked locally by auth redirect to `/auth/signin`.

## Batched Questions

- None yet.

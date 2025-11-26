---
task: fix-middleware-routing
timestamp_utc: 2025-11-26T20:55:00Z
owner: github:@antigravity
reviewers: []
risk: low
flags: []
related_tickets: []
---

# Research: Fix Broken Routes and API

## Requirements

- Functional: Restore routing logic for `/app`, `/ops`, and API rewrites.
- Non-functional: Ensure build passes.

## Existing Patterns & Reuse

- The project uses Next.js 16.
- Middleware logic exists in `src/proxy.ts` (previously `src/middleware.ts`).

## Constraints & Risks

- Next.js 16 deprecates `middleware.ts` in favor of `proxy.ts`.
- However, the user reported that the current setup (with `proxy.ts`) is broken.
- Reverting to `middleware.ts` restores functionality but triggers a deprecation warning.

## Recommended Direction

- Rename `src/proxy.ts` to `src/middleware.ts` to restore immediate functionality.
- Document the deprecation warning for future refactoring.

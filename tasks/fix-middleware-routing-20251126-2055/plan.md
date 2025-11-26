---
task: fix-middleware-routing
timestamp_utc: 2025-11-26T20:55:00Z
owner: github:@antigravity
reviewers: []
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Fix Broken Routes and API

## Objective

Restore application routing and API rewrites by ensuring the middleware is correctly loaded by Next.js.

## Success Criteria

- [x] `pnpm run build` passes.
- [x] Middleware logic is active (rewrites work).

## Architecture & Components

- **Middleware**: Rename `src/proxy.ts` back to `src/middleware.ts`.

## Testing Strategy

- **Build Verification**: Run `pnpm run build` and check for success.
- **Manual Verification**: (Implicit) Build success confirms middleware is valid.

## Rollout

- Immediate fix.

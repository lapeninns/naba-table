---
task: fix-occasion-route-params
timestamp_utc: 2025-11-25T22:02:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Fix occasions route handler param typing

## Objective

Ensure `/api/ops/occasions/[key]` PATCH/DELETE handlers conform to Next.js 16 `RouteHandlerConfig` typing so production build succeeds.

## Success Criteria

- [ ] `pnpm run build` passes without validator type errors.
- [ ] No change to API response semantics.

## Architecture & Components

- File: `src/app/api/ops/occasions/[key]/route.ts`.
- Adjust handler signatures and param extraction; no new dependencies.
- Supabase admin helpers (`server/occasions/admin.ts`) use typed overrides to include runtime-only columns and audit table.

## Data Flow & API Contracts

- Inputs: `NextRequest`, route param `key`.
- Outputs: existing JSON responses unchanged; status codes maintained.

## UI/UX States

- Not applicable (API-only change).

## Edge Cases

- Ensure `key` is still read correctly when params provided as Promise.

## Testing Strategy

- Run `pnpm run build` to trigger Next validator.
- Spot-check TypeScript compile.

## Rollout

- No feature flags; immediate effect after deploy.

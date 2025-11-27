---
task: middleware-regex-build-fix
timestamp_utc: 2025-11-27T23:22:40Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Fix middleware regex for ES2017 target

## Objective

Ensure the middleware regex for public restaurant schedule/calendar-mask paths compiles under `target: ES2017` without changing routing semantics.

## Success Criteria

- [ ] `pnpm run build` succeeds without TypeScript errors.
- [ ] Middleware still exempts `/api/restaurants/:slug/(schedule|calendar-mask)` from ops rewrite guard logic.

## Architecture & Components

- `src/middleware.ts`: update the public restaurant exemption regex to avoid named capture groups while matching the same path shape.

## Data Flow & API Contracts

- API routing rules remain unchanged: on app host, `/api/restaurants/:slug/(schedule|calendar-mask)` should bypass ops guard rewrite.

## UI/UX States

- Not applicable (backend/middleware change only).

## Edge Cases

- Paths with trailing slashes and additional segments after the allowed endpoints should continue to match (`/api/restaurants/foo/schedule/`).
- Other ops services should continue to be guarded and rewritten.

## Testing Strategy

- Run `pnpm run build` to confirm TypeScript compilation succeeds.
- Spot-check logic via existing regex match expectations (manual reasoning; no new automated tests planned since behavior unchanged).

## Rollout

- No flags; change is safe to ship once build passes.
- No migrations or environment changes.

## DB Change Plan

- Not applicable.

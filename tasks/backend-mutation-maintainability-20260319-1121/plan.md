---
task: backend-mutation-maintainability
timestamp_utc: 2026-03-19T11:21:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Backend mutation maintainability

## Objective

We will reduce repeated route-boundary logic in the ops booking lifecycle mutation endpoints so that backend mutation behavior is easier to maintain without changing the public API.

## Success Criteria

- [ ] Lifecycle mutation routes share a single helper for common boundary logic.
- [ ] Shared transition persistence logic is centralized instead of duplicated across multiple routes.
- [ ] Existing route-specific transition preparation and side effects remain explicit in each handler.
- [ ] Focused verification passes after the refactor.

## Architecture & Components

- `src/app/api/ops/bookings/[id]/_shared/lifecycleRoute.ts`: local helper module for lifecycle mutation route plumbing.
- `src/app/api/ops/bookings/[id]/check-in/route.ts`: keep check-in transition preparation, use shared context/persistence helpers.
- `src/app/api/ops/bookings/[id]/check-out/route.ts`: keep table-clear and review-email side effects local, use shared context/persistence helpers.
- `src/app/api/ops/bookings/[id]/no-show/route.ts`: keep no-show-specific reason handling local, use shared context/persistence helpers.
- `src/app/api/ops/bookings/[id]/undo-no-show/route.ts`: keep history lookup local, use shared context/persistence helpers.
- `src/app/api/ops/bookings/[id]/status/route.ts`: optionally reuse shared persistence helper where it matches existing behavior.

## Data Flow & API Contracts

- No request/response contract changes are intended.
- Shared helper inputs:
  - route params or booking id
  - log label and failure message
  - already-prepared lifecycle transition
- Shared helper outputs:
  - either a `NextResponse` error or the resolved route context / persisted transition result

## UI/UX States

- None. Backend-only refactor.

## Edge Cases

- Missing route params or empty request bodies.
- Auth provider errors versus unauthenticated requests.
- Missing bookings, missing membership, or missing restaurant timing data.
- No-op transitions and transition history requirements.

## Testing Strategy

- `pnpm typecheck`
- Focused Vitest runs for existing dashboard/ops tests to catch contract regressions in shared code paths.
- Add targeted helper tests only if a new pure utility warrants direct coverage.

## Rollout

- No rollout change; internal backend refactor only.

## DB Change Plan (if applicable)

- None.

---
task: remove-loyalty-pilot-env
timestamp_utc: 2026-02-07T14:56:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Remove `LOYALTY_PILOT_RESTAURANT_IDS` Env Plumbing

## Objective

We will remove the `LOYALTY_PILOT_RESTAURANT_IDS` environment variable from runtime validation/config and delete its only known usage so that environment invariants remain clean and there is no dead feature-flag surface.

## Success Criteria

- [ ] No references to `LOYALTY_PILOT_RESTAURANT_IDS` (or its derived helpers) remain in runtime code paths (excluding task artifacts).
- [ ] TypeScript build/typecheck succeeds.
- [ ] Tests/lint (project-standard) succeed.

## Architecture & Components

- No new components.
- Single source of truth remains `baseEnvSchema` in `config/env.schema.ts`.

## Data Flow & API Contracts

- No API contract changes.

## UI/UX States

- No UI changes.

## Edge Cases

- If an environment still sets `LOYALTY_PILOT_RESTAURANT_IDS`, it will become an ignored/unknown key. This is acceptable and preferable to keeping dead plumbing.

## Testing Strategy

- Run typecheck and the repo test suite (or the closest available fast checks).
- Add no new tests (pure removal with no behavioral surface remaining).

## Rollout

- No feature flag required.
- This is a safe, low-risk deletion of a dead config surface.

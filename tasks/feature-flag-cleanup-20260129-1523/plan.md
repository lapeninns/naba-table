---
task: feature-flag-cleanup
timestamp_utc: 2026-01-29T15:23:37Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Feature Flag Cleanup

## Objective

Remove unused feature flag paths reported by `flags:audit` to reduce dead config.

## Success Criteria

- [ ] `env.featureFlags` no longer defines unused flags.
- [ ] `clientEnv.flags` no longer defines unused flags.
- [ ] Tests/mocks updated to match new flag surface.
- [ ] Validators pass (`pnpm lint`, `pnpm typecheck`, `pnpm test`).

## Architecture & Components

- `lib/env.ts`
- `lib/env-client.ts`
- `config/env.schema.ts`
- Relevant tests that mock `env.featureFlags`

## Data Flow & API Contracts

- None.

## UI/UX States

- None.

## Edge Cases

- Keep still-used env vars (e.g., realtime flag) intact; only remove unused flag paths.

## Testing Strategy

- Run `pnpm lint`, `pnpm typecheck`, `pnpm test`.

## Rollout

- Immediate.

## DB Change Plan (if applicable)

- Not applicable.

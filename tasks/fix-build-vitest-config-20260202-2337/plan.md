---
task: fix-build-vitest-config
timestamp_utc: 2026-02-02T23:38:14Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Fix build failure (vitest/config)

## Objective

We will restore a successful `pnpm run build` by resolving the missing `vitest/config` module so that CI and local builds pass.

## Success Criteria

- [ ] `pnpm run build` completes successfully.
- [ ] No new lint/typecheck errors introduced.

## Architecture & Components

- `vitest.config.ts`: ensure import resolves.
- `package.json`: ensure `vitest` devDependency exists and is compatible.

## Data Flow & API Contracts

- N/A.

## UI/UX States

- N/A.

## Edge Cases

- Monorepo or workspace dependency overrides could shadow `vitest` version.

## Testing Strategy

- `pnpm run build` (primary).
- Optional: `pnpm run typecheck` if build does not cover all TS checks.

## Rollout

- No feature flag; devDependency-only change.

## DB Change Plan (if applicable)

- N/A.

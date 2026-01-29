---
task: readiness-quality
timestamp_utc: 2026-01-29T13:16:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Implementation Plan: Readiness Quality Gaps

## Objective

We will tighten code quality gates (strict typing, duplicate/dead code checks, coverage thresholds) to close readiness gaps.

## Success Criteria

- [ ] `tsconfig.json` strict enabled and `pnpm typecheck` passes.
- [ ] Dead code/unused dependency and duplicate code tooling added with runnable scripts.
- [ ] Vitest coverage thresholds configured and enforced.

## Architecture & Components

- TypeScript: enable strict in root tsconfig.
- Tooling scripts: add `knip` + `jscpd` configs and scripts.
- Tests: update `vitest.config.ts` with coverage thresholds.

## Data Flow & API Contracts

- None.

## Edge Cases

- Some generated or vendor files must be excluded from new tooling.
- Coverage thresholds should start conservative to avoid false failures.

## Testing Strategy

- Run `pnpm lint`, `pnpm typecheck`, `pnpm test`.

## Rollout

- Warn-only for new tooling if needed; enforce once baselines are clean.

---
task: code-quality-tooling
timestamp_utc: 2026-01-29T12:56:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Code Quality Tooling

## Objective

Introduce lightweight code quality checks (naming, complexity, large-file guard) that run in CI without disrupting existing workflows.

## Success Criteria

- [ ] ESLint enforces naming convention and cyclomatic complexity as warnings.
- [ ] Large-file guard script exists and runs as part of `pnpm lint`.
- [ ] Validators pass (`pnpm lint`, `pnpm typecheck`, `pnpm test`).

## Architecture & Components

- `eslint.config.mjs`: add `@typescript-eslint/naming-convention` and `complexity` rules.
- `scripts/check-large-files.cjs`: Node script to fail on oversized source files.
- `package.json`: wire large-file guard into lint.

## Data Flow & API Contracts

- None.

## Edge Cases

- Exclude generated/build/task directories in large-file scan.
- Keep thresholds conservative to avoid failing existing codebase.

## Testing Strategy

- Run `pnpm lint`, `pnpm typecheck`, `pnpm test`.

## Rollout

- Warning-level rules to minimize disruption; raise to errors later if desired.

## DB Change Plan (if applicable)

- Not applicable.

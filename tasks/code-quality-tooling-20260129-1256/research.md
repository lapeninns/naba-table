---
task: code-quality-tooling
timestamp_utc: 2026-01-29T12:56:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Code Quality Tooling

## Requirements

- Functional:
  - Add naming consistency and cyclomatic complexity checks to ESLint.
  - Add a large-file detection guard for code files.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Tooling must run in CI via existing lint step.
  - No new runtime dependencies; keep scripts Node-only.

## Existing Patterns & Reuse

- ESLint is configured in `eslint.config.mjs` using flat config with TypeScript parser.
- CI runs `pnpm lint` and lint-staged uses `eslint --fix --max-warnings=0` on touched files.

## External Resources

- None required.

## Constraints & Risks

- Avoid introducing lint errors across existing code; prefer warnings for new rules.
- Large-file thresholds should not break current codebase.

## Open Questions (owner, due)

- Q: Desired thresholds for complexity and file size?
  A: Default to conservative values (warn-only) unless maintainers specify stricter limits.

## Recommended Direction (with rationale)

- Add `@typescript-eslint/naming-convention` and `complexity` as warnings to reduce disruption.
- Add `scripts/check-large-files.cjs` and run via `pnpm lint` to ensure CI coverage without extra tooling.

---
task: readiness-quality
timestamp_utc: 2026-01-29T13:16:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Research: Readiness Quality Gaps

## Requirements

- Functional:
  - Enable strict TypeScript in the main tsconfig.
  - Add tooling for dead code, duplicate code, unused dependencies, and coverage thresholds.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Keep checks in CI-friendly scripts; avoid runtime changes.
  - Preserve existing build/test commands.

## Existing Patterns & Reuse

- `tsconfig.strict.json` already enables strict + noUncheckedIndexedAccess for opt-in.
- `vitest.config.ts` has no coverage thresholds configured.
- No existing dead-code/unused dependency/duplicate code tooling.

## External Resources

- https://github.com/webpro/knip (dead code/unused deps)
- https://github.com/kucherenko/jscpd (duplicate code)

## Constraints & Risks

- Enabling strict typing may surface widespread type errors.
- New tooling must be configured to avoid blocking existing code until issues are triaged.

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- Enable strict TypeScript and fix resulting errors.
- Add `knip` and `jscpd` as dev checks (warn-only threshold initially) and configure coverage thresholds in Vitest.

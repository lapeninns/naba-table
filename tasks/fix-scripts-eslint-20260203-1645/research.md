---
task: fix-scripts-eslint
timestamp_utc: 2026-02-03T16:45:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Scripts eslint warnings

## Requirements

- Functional:
- Remove eslint `@typescript-eslint/no-unused-vars` warnings in `scripts/seed-railway-from-cornerhouse.ts` and `scripts/update-railway-details.ts`.
- Non-functional (a11y, perf, security, privacy, i18n):
- No runtime behavior change; scripts should behave the same.

## Existing Patterns & Reuse

- Other scripts use `_` prefix for intentionally unused parameters.

## External Resources

- None.

## Constraints & Risks

- Keep edits minimal; avoid altering script logic.

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- Use `_` prefix for unused parameters and convert type-only const to a type-only definition if possible.

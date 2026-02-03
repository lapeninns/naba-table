---
task: fix-turn-durations-lint
timestamp_utc: 2026-02-03T16:38:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Turn durations lint warning

## Requirements

- Functional:
- Remove eslint `@typescript-eslint/no-unused-vars` warning for `_removed` in `TurnDurationsSection`.
- Non-functional (a11y, perf, security, privacy, i18n):
- No behavior change; UI/a11y must remain intact.

## Existing Patterns & Reuse

- Existing state update patterns in `TurnDurationsSection` use `setDraft` with immutable updates.

## External Resources

- None.

## Constraints & Risks

- Must keep update logic immutable and behavior identical.
- Keep change minimal to avoid regressions.

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- Replace object rest destructuring with unused binding by cloning and deleting key to avoid unused variable warning while preserving behavior.

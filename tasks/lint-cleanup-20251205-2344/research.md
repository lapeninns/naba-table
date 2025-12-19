---
task: lint-cleanup
timestamp_utc: 2025-12-05T23:44:49Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Lint warnings cleanup

## Requirements

- Functional: Remove ESLint unused-variable warnings in `ScheduleAwareTimestampPicker.tsx` so `eslint --max-warnings=0` passes.
- Non-functional: Keep behavior unchanged; adhere to AGENTS a11y/security standards.

## Existing Patterns & Reuse

- File already uses React hooks and derived memoized values; removing unused imports/variables aligns with existing style.

## External Resources

- None required.

## Constraints & Risks

- Avoid deleting variables that may be intended for future use; ensure only unused items are removed or prefixed safely.

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- Remove unused imports (`Loader2`, `useId`) and unused derived variables (`loadError`, `availableCount`, `selectedSlotDescriptor`).
- Re-run targeted ESLint on the file to confirm warnings are cleared.

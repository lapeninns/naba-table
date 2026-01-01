---
task: fix-plan-step-a11y
timestamp_utc: 2026-01-01T16:36:51Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Fix plan-step a11y regressions

## Requirements

- Functional:
  - Time select shows placeholder when no value is selected.
  - Notes label is programmatically associated with its textarea.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Restore label/textarea association for screen readers and click-to-focus.
  - No new performance impact; preserve existing behavior.

## Existing Patterns & Reuse

- Calendar time select behavior in `reserve/features/reservations/wizard/ui/steps/plan-step/components/Calendar24Field.tsx`.
- Form labeling patterns in adjacent plan-step fields.

## External Resources

- N/A

## Constraints & Risks

- Must follow root and reserve AGENTS.md policies.
- Manual UI QA via Chrome DevTools MCP required for UI changes.

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- Restore Radix Select placeholder behavior by passing `undefined` when the input is empty.
- Reinstate `id`/`htmlFor` link for Notes field to restore accessibility.

---
task: a11y-remediation
timestamp_utc: 2026-01-29T11:01:00Z
owner: github:@codex
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: A11y Remediation (Marketing & Guest)

## Requirements

- Functional:
  - Resolve remaining Playwright a11y violations (contrast, heading order, landmark/region issues).
- Non-functional (a11y, perf, security, privacy, i18n):
  - WCAG contrast compliance for text and badges.
  - Correct heading hierarchy and landmark regions.
  - No regressions in existing tests.

## Existing Patterns & Reuse

- Tailwind color utilities already used across landing and guest components.
- Existing layout and badge patterns in landing and booking components.

## External Resources

- None.

## Constraints & Risks

- Must keep UI changes minimal and consistent with existing design system.
- Manual UI QA via Chrome DevTools MCP is required for UI changes.

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- Update contrast-critical classes and heading levels where violations remain, then re-run a11y suite and manual QA to confirm fixes.

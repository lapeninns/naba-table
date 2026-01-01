---
task: responsiveness-fixes
timestamp_utc: 2026-01-01T15:14:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Responsiveness Fixes (Ops App)

## Requirements

- Functional:
  - Increase touch target sizes to meet 44x44px on mobile for common actions.
  - Fix console/a11y warnings on /app/new-bookings (label-for mismatch, missing id/name).
  - Address calendar mask fetch warnings if caused by client behavior.
- Non-functional (a11y, perf, security, privacy, i18n):
  - A11y: correct labeling; preserve keyboard nav; no regressions.

## Existing Patterns & Reuse

- Use existing button components and layout utilities; avoid custom styles unless needed.

## External Resources

- WCAG touch target sizing (44x44).

## Constraints & Risks

- Must follow AGENTS SDLC phases.
- Manual UI QA via Chrome DevTools MCP required post-change.
- Avoid over-scoping beyond identified issues.

## Open Questions (owner, due)

- Q: Confirm whether fixes should include sidebar icon target sizing on tablet/desktop. (owner: github:@amanshresthaa, due: 2026-01-02)

## Recommended Direction (with rationale)

- Update relevant button/link components to meet 44px min size on mobile; fix form label/id wiring in new-bookings flow to clear console/a11y issues.

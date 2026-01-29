---
task: governance-templates
timestamp_utc: 2026-01-29T15:17:10Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Governance Templates

## Requirements

- Functional: Add issue templates and a PR template under `.github/`.
- Non-functional (a11y, perf, security, privacy, i18n): N/A (static GitHub metadata).

## Existing Patterns & Reuse

- `AGENTS.md` Appendix E provides a required PR template format.

## External Resources

- None required.

## Constraints & Risks

- Must follow AGENTS.md SDLC and run validators after changes.
- Avoid introducing process changes beyond templates.

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- Add `.github/PULL_REQUEST_TEMPLATE.md` using the AGENTS.md appendix template.
- Add `.github/ISSUE_TEMPLATE` templates for bug reports and feature requests to satisfy governance gap.

---
task: fix-skill-yaml
timestamp_utc: 2026-01-22T00:26:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Fix invalid SKILL.md YAML headers

## Requirements

- Functional:
  - Add missing `name` field to SKILL.md YAML headers for the six invalid global skills.
  - Preserve existing skill content beyond the YAML header.
- Non-functional (a11y, perf, security, privacy, i18n):
  - No runtime behavior changes; metadata fix only.
  - No secrets added.

## Existing Patterns & Reuse

- Global skills live under `~/.codex/skills/<skill>/SKILL.md` with YAML frontmatter.

## External Resources

- None.

## Constraints & Risks

- Global skills path is outside repo; edit carefully and only the YAML header.
- Avoid changing skill body content or behavior.

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- Add the missing `name` field to each affected SKILL.md YAML header to satisfy loader validation with minimal, targeted edits.

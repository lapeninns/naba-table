---
task: fix-skill-frontmatter
timestamp_utc: 2026-01-22T00:42:24Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Fix SKILL.md frontmatter requirements

## Requirements

- Functional:
  - Ensure each SKILL.md has required YAML fields: `name` and `description`.
  - Keep `name` and `description` single-line and within documented length limits.
  - Preserve skill body content.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Metadata-only change; no behavior changes.
  - No secrets added.

## Existing Patterns & Reuse

- Global skills live under `~/.codex/skills/<skill>/SKILL.md` with YAML frontmatter.

## External Resources

- OpenAI Codex skills docs (required frontmatter fields and length/format constraints).

## Constraints & Risks

- Global skills path is outside repo; edit carefully and only the YAML header.
- Avoid changing skill body content or structure.

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- Add missing required fields (including `description`) to YAML frontmatter for affected skills, ensuring single-line length limits to satisfy loader validation.

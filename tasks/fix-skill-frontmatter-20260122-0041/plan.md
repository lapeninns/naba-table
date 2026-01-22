---
task: fix-skill-frontmatter
timestamp_utc: 2026-01-22T00:42:24Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Fix SKILL.md frontmatter requirements

## Objective

Ensure Codex global skills load without errors by adding any missing required frontmatter fields.

## Success Criteria

- [ ] Each affected SKILL.md includes required frontmatter fields (`name`, `description`).
- [ ] `name` and `description` remain single-line and within documented length limits.
- [ ] No other content changes in the skill files.

## Architecture & Components

- No code components; metadata-only change.

## Data Flow & API Contracts

- Not applicable.

## UI/UX States

- Not applicable.

## Edge Cases

- YAML frontmatter must remain valid and properly delimited.
- `description` must be a single line within allowed length.

## Testing Strategy

- Manual verification: inspect frontmatter for required fields.

## Rollout

- Not applicable.

## DB Change Plan (if applicable)

- Not applicable.

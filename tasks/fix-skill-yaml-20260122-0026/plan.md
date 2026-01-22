---
task: fix-skill-yaml
timestamp_utc: 2026-01-22T00:26:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Fix invalid SKILL.md YAML headers

## Objective

We will add missing `name` fields to invalid global SKILL.md YAML headers so that skill loading succeeds without warnings.

## Success Criteria

- [ ] Each affected SKILL.md header includes a valid `name` field.
- [ ] No other content changes in the skill files.

## Architecture & Components

- No code components; metadata-only change.

## Data Flow & API Contracts

- Not applicable.

## UI/UX States

- Not applicable.

## Edge Cases

- YAML frontmatter must remain valid and properly delimited.

## Testing Strategy

- Manual verification by inspecting the YAML headers for the six affected skills.

## Rollout

- Not applicable.

## DB Change Plan (if applicable)

- Not applicable.

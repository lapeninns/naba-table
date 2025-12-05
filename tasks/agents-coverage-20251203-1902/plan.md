---
task: agents-coverage
timestamp_utc: 2025-12-03T19:02:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: AGENTS coverage

## Objective

Create missing subproject `AGENTS.md` files so every package/app directory has local policy guidance consistent with root rules.

## Success Criteria

- [ ] Six new `AGENTS.md` files added with correct frontmatter and extends paths.
- [ ] Content mirrors existing pattern and includes build/test commands + domain rules.
- [ ] No unrelated code changes.

## Architecture & Components

- Artifacts: Markdown policy files in `reserve/`, `server/`, `lib/`, `components/`, `hooks/`, `libs/`.

## Data Flow & API Contracts

- Not applicable (docs only).

## UI/UX States

- N/A.

## Edge Cases

- Correct relative `extends` path from each directory.
- Ensure scope set to `subproject` and agents_version 5.3.

## Testing Strategy

- Manual validation: run `rg --files -g 'AGENTS.md'` to confirm presence; spot-check frontmatter.

## Rollout

- Direct commit in repo; no feature flags.

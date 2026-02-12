---
task: shell-tool-runtime-policy
timestamp_utc: 2026-02-11T23:56:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Shell tool runtime policy

## Objective

Add a focused shell runtime/security section to root `AGENTS.md` so OpenAI Shell tool constraints are codified in daily execution rules.

## Success Criteria

- [ ] New `8.7 Shell Tool Runtime & Security Policy` section exists in `AGENTS.md`.
- [ ] Section includes hosted/local mode selection, `/mnt/data` boundary, network policy, domain secrets, session continuity, and error handling rules.
- [ ] Quick-reference includes a shell runtime checklist block.

## Architecture & Components

- Documentation-only edit to root `AGENTS.md`.
- Add one section in tooling area and one checklist block in quick reference.

## Testing Strategy

- Manual markdown review for numbering and consistency.
- Ensure no contradictions with non-overridable core rules.

## Rollout

- Effective immediately after merge.

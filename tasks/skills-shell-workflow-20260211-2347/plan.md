---
task: skills-shell-workflow
timestamp_utc: 2026-02-11T23:47:11Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Skills + Shell workflow adoption

## Objective

Incorporate proven skills/shell execution practices from the OpenAI article into the repository's canonical `AGENTS.md` workflow so repeat tasks are faster and more reliable.

## Success Criteria

- [ ] `AGENTS.md` includes a new section for skills and shell execution practices.
- [ ] Each adopted practice is explicit, actionable, and aligned with existing non-negotiables.
- [ ] Quick-reference checklist includes a skills/shell block for day-to-day use.

## Architecture & Components

- Documentation-only update in root `AGENTS.md`.
- New subsection after existing tooling/collaboration guidance.
- New checklist block in quick-reference section.

## Data Flow & API Contracts

- N/A.

## UI/UX States

- N/A.

## Edge Cases

- Prevent conflicts with existing rules on MCP-first usage, security, and task artifacts.
- Avoid making optional utilities (like tmux) mandatory in environments where unavailable.

## Testing Strategy

- Manual review of markdown structure and section numbering.
- Verify new rules do not contradict existing mandatory constraints.

## Rollout

- Effective immediately after merge as canonical workflow policy.
- Future tasks should cite this section when applying skill-or-shell-heavy workflows.

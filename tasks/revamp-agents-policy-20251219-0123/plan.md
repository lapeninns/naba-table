---
task: revamp-agents-policy
timestamp_utc: 2025-12-19T01:23:42Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: AGENTS Policy Revamp

## Objective

Replace root and nested `AGENTS.md` files with concise, repository-specific guidance that matches current code structure, scripts, and safety rules.

## Success Criteria

- [ ] Root `AGENTS.md` reflects actual workflows, commands, and repo map.
- [ ] Nested `AGENTS.md` reflect responsibilities/patterns for their directories.
- [ ] Non-negotiable safety rules (no secrets, remote-only Supabase, UI QA) remain explicit.
- [ ] Frontmatter and `extends:` paths pass casing/structure checks.

## Architecture & Components

- Root policy: overall SDLC workflow, task structure, repo map, security, DB rules, UI/a11y/perf, testing, and tool usage.
- Subproject policies: directory-specific constraints and patterns.

## Planned File Changes

- Replace: `AGENTS.md`
- Replace: `src/app/AGENTS.md`
- Replace: `src/components/AGENTS.md`
- Replace: `src/hooks/AGENTS.md`
- Replace: `src/services/ops/AGENTS.md`
- Add (if approved): `reserve/AGENTS.md`
- Add (if approved): `server/AGENTS.md`
- Add (if approved): `components/AGENTS.md`
- Add (if approved): `hooks/AGENTS.md`

## Data Flow & API Contracts

- N/A (policy docs).

## UI/UX States

- N/A.

## Edge Cases

- `extends:` paths differ per folder depth; verify each.
- Avoid references to tools not present in repo.

## Testing Strategy

- Doc review only; no automated tests.

## Rollout

- Replace files in-place; no feature flags.

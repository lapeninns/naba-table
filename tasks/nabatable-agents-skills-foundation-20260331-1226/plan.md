---
task: nabatable-agents-skills-foundation
timestamp_utc: 2026-03-31T12:26:26Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Plan: Nabatable AGENTS.md and local Codex skill foundation

## Objective

Make Nabatable's local Codex harness materially more useful by adding a small repo-specific skill foundation and wiring root `AGENTS.md` to it.

## Success Criteria

- [ ] `.codex/skills/` contains repo-local foundational skills specialized to Nabatable.
- [ ] Each new skill includes Codex-native metadata via `agents/openai.yaml`.
- [ ] Root `AGENTS.md` references repo-local foundation skills in the main skill guidance and SDLC flow.
- [ ] `.codex/skills/README.md` documents the local foundation set.

## Planned Skills

1. `nabatable-task-harness`
   - Focus: AGENTS traversal, task-folder creation, continuity updates, and artifact completeness.
2. `nabatable-ui-proof`
   - Focus: UI verification rules, authenticated-route fallback, stale harness handling, and artifact capture.
3. `nabatable-fullstack-delivery`
   - Focus: deciding between RED-first feature work, verification-first regression work, and test-only changes.

## Files To Change

- `.codex/skills/README.md`
- `.codex/skills/nabatable-task-harness/SKILL.md`
- `.codex/skills/nabatable-task-harness/agents/openai.yaml`
- `.codex/skills/nabatable-ui-proof/SKILL.md`
- `.codex/skills/nabatable-ui-proof/agents/openai.yaml`
- `.codex/skills/nabatable-fullstack-delivery/SKILL.md`
- `.codex/skills/nabatable-fullstack-delivery/agents/openai.yaml`
- `AGENTS.md`
- `CONTINUITY.md`

## Validation Strategy

- Manual review for consistency between skill names, `when_to_use`, and AGENTS references.
- Confirm each local skill has both `SKILL.md` and `agents/openai.yaml`.
- Search for stale skill names or missing references after edits.

## Rollout

- Effective immediately as repo-local Codex guidance.
- Future work can invoke `$nabatable-task-harness`, `$nabatable-ui-proof`, and `$nabatable-fullstack-delivery` explicitly or rely on description/path triggers.

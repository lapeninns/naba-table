---
task: nabatable-agents-skills-foundation
timestamp_utc: 2026-03-31T12:26:26Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Verification

## Planned Checks

- Confirm new skill directories exist under `.codex/skills/` with both `SKILL.md` and `agents/openai.yaml`.
- Confirm root `AGENTS.md` references the new repo-local foundation skills.
- Confirm no stale renamed references remain after the edits.

## Results

- Confirmed `.codex/skills/` now contains:
  - `nabatable-task-harness/SKILL.md`
  - `nabatable-task-harness/agents/openai.yaml`
  - `nabatable-ui-proof/SKILL.md`
  - `nabatable-ui-proof/agents/openai.yaml`
  - `nabatable-fullstack-delivery/SKILL.md`
  - `nabatable-fullstack-delivery/agents/openai.yaml`
- Confirmed root `AGENTS.md` references all three repo-local foundation skills in:
  - top-level Skills Directory guidance
  - SDLC phase guidance
  - skill invocation rules
  - final Skills Directory appendix
- Confirmed `.codex/skills/README.md` lists the local foundation set and their intended use.
- Validation method: manual file and reference inspection via `find`, `rg`, and targeted `sed`.
- Automated tests not run because this change is documentation and skill metadata only.

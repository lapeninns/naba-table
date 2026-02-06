# Repo-Local Codex Skills

This directory is reserved for repo-local Codex skills.

## Skill Locations

- **Repo-local**: `.codex/skills/<skill-name>/SKILL.md`
- **Global**: `~/.codex/skills/<skill-name>/SKILL.md`
- If a skill isn't found locally, fall back to the global path and load any `references/` or `scripts/` referenced by that skill.

## Trigger Rules

A skill applies for a given turn when either condition is met:

1. The user names the skill explicitly (e.g., `$SkillName`).
2. The task matches the skill's `description` field in its `SKILL.md` frontmatter ("description as trigger").

## Progressive Disclosure

- Open the `SKILL.md` and read only enough to follow the workflow.
- Load only the specific `references/` files needed by the current step.
- Prefer running or patching `scripts/` over retyping their content.
- Reuse templates and assets when present.
- Do not bulk-load unrelated references or scripts.

## Fallback Behavior

- If a named skill can't be found or read, state that briefly and proceed with the best fallback approach.
- Do not silently skip or fail.

## Security

Do not commit secrets, tokens, or environment-specific credentials.

## Evidence (sessions-backed)

These rules are grounded in the following session rollout files (paraphrased; no raw payloads):

- Trigger rules: `~/.codex/sessions/2025/12/25/rollout-…-019b5620-….jsonl:1` (R5), `~/.codex/sessions/2026/02/06/rollout-…-019c3308-….jsonl:4` (R3)
- Progressive disclosure: `~/.codex/sessions/2026/02/06/rollout-…-019c3308-….jsonl:4` (R3)
- Fallback behavior: `~/.codex/sessions/2026/02/06/rollout-…-019c3308-….jsonl:4` (R3)
- Skill locations: `~/.codex/sessions/2026/01/28/rollout-…-019c04a5-….jsonl:3` (R1), `~/.codex/sessions/2026/02/06/rollout-…-019c3308-….jsonl:4` (R3)

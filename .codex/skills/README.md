# Repo-Local Codex Skills

This directory is reserved for repo-local Codex skills.

## Skill Locations

- **Repo-local**: `.codex/skills/<skill-name>/SKILL.md`
- **Global**: `~/.codex/skills/<skill-name>/SKILL.md`
- If a skill isn't found locally, fall back to the global path.

## Usage

- A skill applies when the user names it explicitly or when the task matches the skill's `description` field.
- Load only the `SKILL.md` and specific `references/` files needed by the current step.
- Do not bulk-load unrelated references or scripts.

## Security

Do not commit secrets, tokens, or environment-specific credentials.

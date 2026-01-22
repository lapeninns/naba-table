---
task: move-skills-global
timestamp_utc: 2026-01-22T00:02:56Z
owner: github:@sisyphus
reviewers: []
risk: low
flags: []
related_tickets: []
---

# Research: Move Skills to Codex Global

## Requirements

- **Functional**:
  - Move or sync repo `skills/` content to the Codex global skills location.
  - Preserve any required repo references or update them if relocation changes paths.
- **Non-functional**:
  - No loss of existing global skills.
  - Avoid breaking AGENTS/skill discovery expectations.

## Existing Patterns & Reuse

- Repo already has `skills/` as markdown files (not the global `SKILL.md` folder structure).
- Global Codex skills live under `~/.codex/skills/` (folder-per-skill with `SKILL.md`).

## External Resources

- None.

## Constraints & Risks

- Root AGENTS requires following SDLC phases and task artifacts.
- Moving `skills/` out of repo may break references in `AGENTS.md` and other docs.
- Global `~/.codex/skills/` is outside sandbox write roots; escalated permission required to modify.
- Format mismatch: repo `skills/*.md` vs global `skills/<name>/SKILL.md`.

## Open Questions (owner, due)

- Q: Do you want a **move** (remove repo `skills/`) or a **copy/sync** (keep repo `skills/` intact)? (owner: github:@sisyphus, due: 2026-01-22)
  A: Move and remove repo `skills/`.
- Q: Should we **convert** repo skills into Codex global skill folder format, or just place the raw `.md` files in `~/.codex/skills/`? (owner: github:@sisyphus, due: 2026-01-22)
  A: Convert to `~/.codex/skills/<name>/SKILL.md`.
- Q: If converted, should we also update `/AGENTS.md` references to point to the global paths? (owner: github:@sisyphus, due: 2026-01-22)
  A: Yes, update repo references.

## Recommended Direction (with rationale)

- **Move** repo `skills/` into `~/.codex/skills/` as skill folders (each with `SKILL.md`) and update repo references. This matches the explicit request while preventing broken references.
- Require confirmation before deleting or repointing any repo references.

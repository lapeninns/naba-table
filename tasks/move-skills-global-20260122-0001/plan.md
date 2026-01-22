---
task: move-skills-global
timestamp_utc: 2026-01-22T00:02:56Z
owner: github:@sisyphus
reviewers: []
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Move Skills to Codex Global

## Objective

Enable Codex global skills to include this repo's `skills/` content without breaking existing repo references.

## Success Criteria

- [ ] Global skills updated per the chosen approach (move or copy/sync).
- [ ] Repo references remain valid or are updated intentionally (no accidental breakage).
- [ ] Change is documented in `verification.md` with evidence of the target location contents.

## Architecture & Components

- Source: `skills/*.md` (repo markdown skill docs).
- Target: `~/.codex/skills/` (global Codex skill folders).

## Data Flow & API Contracts

- N/A.

## UI/UX States

- N/A.

## Edge Cases

- Existing global skill folders with same names.
- Mismatch between repo markdown format and global `SKILL.md` expectations.
- Sandbox write restrictions for `~/.codex/skills/`.

## Testing Strategy

- Manual verification: list and inspect target `~/.codex/skills/` entries.

## Rollout

- N/A (file move/copy only).

## Implementation Steps

1. Create `~/.codex/skills/<name>/SKILL.md` from each repo `skills/<name>.md`.
2. Remove repo `skills/` and update `/AGENTS.md` references to global paths.
3. Verify target with `ls` and spot-check files; record in `verification.md`.

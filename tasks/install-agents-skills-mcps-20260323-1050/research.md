---
task: install-agents-skills-mcps
timestamp_utc: 2026-03-23T10:50:44Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Install AGENTS Skills And MCPs

## Requirements

- Functional:
  - Install the skills referenced by `/AGENTS.md` into `~/.codex/skills`.
  - Configure the MCP integrations referenced by `/AGENTS.md` in `~/.codex/config.toml`.
  - Prefer restoring from available external-drive or Time Machine data before falling back to fresh installs.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Do not expose or commit secrets.
  - Keep MCP configuration env-based where credentials are required.
  - Preserve existing Codex configuration.

## Existing Patterns & Reuse

- Codex home configuration lives in `/Users/amankumarshrestha/.codex/config.toml`.
- Existing preinstalled system skills are present under `/Users/amankumarshrestha/.codex/skills/.system/`.
- The `skill-installer` system skill provides helper scripts for GitHub-backed skill installation.
- Prior MCP sync work is documented in `tasks/sync-mcp-configs-20260123-1730/`.

## External Resources

- `/Users/amankumarshrestha/.codex/skills/.system/skill-installer/SKILL.md` - official local installer workflow for Codex skills.

## Constraints & Risks

- `/Volumes/T9` currently returns `Operation not permitted` from the terminal, so external-drive recovery is blocked by OS permissions unless access is granted elsewhere.
- `tmutil destinationinfo` reports no configured Time Machine destination at the moment, so automatic Time Machine recovery is not currently available.
- Some AGENTS-referenced skills may be private/custom and unavailable from the public curated skill repo.
- MCP server definitions require correct command/env wiring; placeholders are safer than hard-coded secrets.

## Open Questions (owner, due)

- Q: Are the AGENTS-referenced custom skills available in another private repo or backup location not currently readable from the shell?
  A: Unknown; proceeding with local/official discovery first. Owner: github:@amankumarshrestha.

## Recommended Direction (with rationale)

- Create the required task artifacts, inventory all referenced skills/MCPs, attempt local and backup recovery first, then install any recoverable/public skills and add MCP config entries using env-safe placeholders. Record any unrecoverable items and permission blockers in verification.

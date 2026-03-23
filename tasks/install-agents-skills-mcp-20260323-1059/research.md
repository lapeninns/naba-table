---
task: install-agents-skills-mcp
timestamp_utc: 2026-03-23T10:59:32Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Install AGENTS Skills And MCP

## Requirements

- Functional:
  - Install all skills referenced by the root [AGENTS.md](/Users/amankumarshrestha/LapenInns%20Project/nabatableLP/AGENTS.md) that are not currently present in the active Codex skill directories.
  - Install the MCP server definitions referenced by [AGENTS.md](/Users/amankumarshrestha/LapenInns%20Project/nabatableLP/AGENTS.md) into the active Codex config.
  - Source restore information from the mounted external drive and Time Machine snapshot when possible.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Do not expose secrets while inspecting backed-up config files.
  - Preserve the current Codex model/profile settings; make minimal config edits.
  - Avoid destructive replacement of existing user configuration.

## Existing Patterns & Reuse

- Active skill directories currently exist at `/Users/amankumarshrestha/.codex/skills` and `/Users/amankumarshrestha/.agents/skills`.
- External-drive snapshot at `/Volumes/T9/2026-02-22-174000.previous/Macintosh HD - Data/Users/amankumarshrestha/` contains prior `.codex/skills`, `.agents/skills`, and `.codex/config.toml`.
- Time Machine snapshot at `/Volumes/.timemachine/9EAABE86-01C1-4A24-8077-1DDB44861A5E/2026-02-19-162727.backup/2026-02-19-162727.backup/Macintosh HD - Data/Users/amankumarshrestha/` confirms the same skill set and MCP layout.

## External Resources

- External drive snapshot (`/Volumes/T9/...`) — primary restore source with previously working Codex skills and MCP definitions.
- Time Machine snapshot (`/Volumes/.timemachine/...`) — secondary verification source to confirm the same entries existed in a separate backup.

## Constraints & Risks

- Current `/Users/amankumarshrestha/.codex/config.toml` is intentionally minimal, so overwriting it would risk losing current preferences.
- Some MCPs in the backup are remote URL definitions and may still require valid auth or project-specific access outside this install step.
- AGENTS.md also mentions Chrome DevTools MCP for UI QA, but this request is installation work only; no repo UI change is being made here.

## Open Questions (owner, due)

- Q: Should AGENTS.md-referenced skills be restored into both `.codex` and `.agents`, or only the active Codex directory?
  A: Assume both, because the current environment reads from both locations and the user asked to install all mentioned skills.

## Recommended Direction (with rationale)

- Restore the missing AGENTS.md-referenced skills from the external-drive snapshot into both active skill roots, using the Time Machine snapshot as confirmation.
- Merge only the AGENTS.md-referenced MCP server entries from the backed-up Codex config into the active `/Users/amankumarshrestha/.codex/config.toml`, keeping the current model and feature settings intact.

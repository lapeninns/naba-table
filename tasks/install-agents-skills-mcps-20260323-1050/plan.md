---
task: install-agents-skills-mcps
timestamp_utc: 2026-03-23T10:50:44Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Install AGENTS Skills And MCPs

## Objective

We will align this machine's Codex setup with the repository `AGENTS.md` by installing the referenced skills and configuring the referenced MCP integrations, while preferring recovery from existing backups when available.

## Success Criteria

- [ ] The AGENTS-referenced skills are either installed in `~/.codex/skills` or documented as unavailable/blockered.
- [ ] `~/.codex/config.toml` contains MCP entries for the AGENTS-referenced integrations with secret-safe configuration.
- [ ] External-drive and Time Machine recovery attempts are documented.
- [ ] Verification captures the final installed state and unresolved blockers.

## Architecture & Components

- Root policy source: `/Users/amankumarshrestha/LapenInns Project/nabatableLP/AGENTS.md`.
- Skills destination: `/Users/amankumarshrestha/.codex/skills/`.
- MCP config target: `/Users/amankumarshrestha/.codex/config.toml`.
- Evidence: `tasks/install-agents-skills-mcps-20260323-1050/artifacts/`.

## Data Flow & API Contracts

- Configuration-only change. No app API contracts are modified.

## UI/UX States

- None.

## Edge Cases

- Hidden/system skills may already exist and should not be overwritten unnecessarily.
- Custom skills may not be publicly downloadable.
- External-drive and Time Machine sources may be mounted but unreadable due to macOS privacy restrictions.
- Some MCP servers may require local binaries not yet installed.

## Testing Strategy

- Validate skill directory presence for each referenced skill.
- Validate TOML syntax by reading back the updated config.
- Validate MCP config entries are present and secret-safe.

## Rollout

- No staged rollout required; local developer-environment configuration only.

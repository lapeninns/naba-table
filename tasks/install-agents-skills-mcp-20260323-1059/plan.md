---
task: install-agents-skills-mcp
timestamp_utc: 2026-03-23T10:59:32Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Install AGENTS Skills And MCP

## Objective

We will restore the skills and MCP entries referenced by [AGENTS.md](/Users/amankumarshrestha/LapenInns%20Project/nabatableLP/AGENTS.md) so that the local Codex environment matches the project policy and can use the same workflow guidance in future sessions.

## Success Criteria

- [ ] All AGENTS.md-referenced skills missing from active directories are restored from backup sources.
- [ ] Active `/Users/amankumarshrestha/.codex/config.toml` contains the AGENTS.md-referenced MCP server definitions.
- [ ] No existing non-MCP Codex preferences are removed.
- [ ] Task verification records the backup sources and the resulting installed inventory.

## Architecture & Components

- Task folder: stores research, plan, live checklist, and verification evidence.
- `/Users/amankumarshrestha/.codex/skills`: primary Codex skill root.
- `/Users/amankumarshrestha/.agents/skills`: secondary agent skill root used by the current environment.
- `/Users/amankumarshrestha/.codex/config.toml`: active Codex config receiving merged MCP entries.
  State: user-level machine config | URL state: not applicable

## Data Flow & API Contracts

Endpoint: none
Request: local file restore from backup snapshots
Response: restored skill directories and merged Codex MCP config
Errors: filesystem missing snapshot, duplicate skill directory, invalid TOML

## UI/UX States

- Not applicable for product UI.

## Edge Cases

- Skill already exists in one directory but not the other.
- Backup contains project-specific MCP args that should not overwrite current model settings.
- Time Machine and external-drive snapshots diverge; prefer the newer external-drive snapshot but note the mismatch.

## Testing Strategy

- Filesystem verification of restored skill directories.
- Config verification by reading back the active TOML sections for MCP entries.
- No product UI testing required because this is environment setup, not app UI code.

## Rollout

- Feature flag: none
- Exposure: immediate on next Codex restart
- Monitoring: manual inspection of skill directories and Codex config
- Kill-switch: remove added skill directories and delete added MCP sections from config backup if needed

## DB Change Plan (if applicable)

- Not applicable.

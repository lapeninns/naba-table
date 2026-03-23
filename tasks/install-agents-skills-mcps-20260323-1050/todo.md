---
task: install-agents-skills-mcps
timestamp_utc: 2026-03-23T10:50:44Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Create task folder and SDLC artifacts.
- [ ] Inventory AGENTS-referenced skills and MCP integrations.
- [ ] Attempt recovery from external-drive and Time Machine sources.

## Core

- [ ] Install or restore missing skills into `~/.codex/skills`.
- [ ] Update `~/.codex/config.toml` with referenced MCP integrations.
- [ ] Keep configuration env-based for any secrets.

## Verification

- [ ] Re-read installed skill directories.
- [ ] Re-read MCP config and confirm referenced entries exist.
- [ ] Record blockers and recovery status in `verification.md`.

## Notes

- Assumptions:
  - `github:@amankumarshrestha` is the correct owner handle for task metadata.
  - External-drive restoration may not be possible from the current terminal session if macOS denies access.
- Deviations:
  - None yet.

## Batched Questions

- None yet.

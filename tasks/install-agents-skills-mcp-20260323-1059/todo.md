---
task: install-agents-skills-mcp
timestamp_utc: 2026-03-23T10:59:32Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Inventory active skills and MCP config
- [x] Locate external-drive and Time Machine backup sources
- [x] Back up active Codex config before editing

## Core

- [x] Restore missing skills into `/Users/amankumarshrestha/.codex/skills`
- [x] Restore missing skills into `/Users/amankumarshrestha/.agents/skills`
- [x] Merge AGENTS.md-referenced MCP entries into `/Users/amankumarshrestha/.codex/config.toml`

## UI/UX

- [x] Not applicable

## Tests

- [x] Verify restored skill directories exist and contain `SKILL.md`
- [x] Verify active Codex config exposes the expected `[mcp_servers.*]` entries
- [x] Confirm task evidence is written to `verification.md`
- [x] Axe/Accessibility checks not applicable

## Notes

- Assumptions:
  - The external-drive snapshot is the preferred restore source because it is newer than the visible Time Machine snapshot.
  - Restoring skills into both active roots is desirable because this environment currently reads from both.
- Deviations:
  - Chrome DevTools MCP QA is not applicable because no repo UI code is changing.
  - `augment-context-engine` was restored as an `npx` invocation of `@augmentcode/auggie` because the older backup depended on a missing local `auggie` binary.

## Batched Questions

- None at this stage.

---
task: install-agents-skills-mcp
timestamp_utc: 2026-03-23T10:59:32Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

Tool: Not applicable for environment-only setup

### Console & Network

- [x] Not applicable

### DOM & Accessibility

- [x] Not applicable

### Performance (profiled; mobile; 4x CPU; 4G)

- Not applicable

### Device Emulation

- [x] Not applicable

## Test Outcomes

- [x] Restored skill directories verified
- [x] Codex MCP config verified
- [x] Restart requirement noted

### Skills Restored

- Source of truth used for restore: `/Volumes/T9/2026-02-22-174000.previous/Macintosh HD - Data/Users/amankumarshrestha/`
- Secondary confirmation source: `/Volumes/.timemachine/9EAABE86-01C1-4A24-8077-1DDB44861A5E/2026-02-19-162727.backup/2026-02-19-162727.backup/Macintosh HD - Data/Users/amankumarshrestha/`
- Restored into `/Users/amankumarshrestha/.codex/skills`:
  - `continuity-ledger`
  - `frontend-aesthetics`
  - `mcp-integration`
  - `multi-agent-collaboration`
  - `style-principles`
- Restored into `/Users/amankumarshrestha/.agents/skills`:
  - `continuity-ledger`
  - `frontend-aesthetics`
  - `mcp-integration`
  - `multi-agent-collaboration`
  - `style-principles`
- Verification method: confirmed `SKILL.md` exists for every restored skill in both active roots.

### MCP Configuration Added

- Active config file updated: `/Users/amankumarshrestha/.codex/config.toml`
- Backup created before edit: `/Users/amankumarshrestha/.codex/config.toml.bak-20260323-1059`
- Added MCP servers:
  - `chrome-devtools`
  - `context7`
  - `shadcn`
  - `augment-context-engine`
  - `deepwiki`
  - `supabase`
  - `posthog`
- `supabase` was configured against project ref `ndxmivcrehsacuerwxtm`, derived from this repo's `NEXT_PUBLIC_SUPABASE_URL`.
- `augment-context-engine` uses `npx -y @augmentcode/auggie --mcp -m default -w /Users/amankumarshrestha/LapenInns Project/nabatableLP` because the older backup referenced a missing local binary.

### Runtime Smoke Checks

- `npx -y @augmentcode/auggie --version` returned `0.20.1`.
- `npx -y shadcn@latest mcp --help` returned command help successfully.
- Registry resolution succeeded for:
  - `chrome-devtools-mcp@latest` -> `0.20.3`
  - `@upstash/context7-mcp` -> `2.1.4`
  - `mcp-remote@latest` -> `0.1.38`
- Remote URL-backed servers (`deepwiki`, `supabase`) were configured but not fully connected in this task because connection/auth occurs at MCP runtime.

## Artifacts

- Evidence summarized from filesystem inspection, backup comparison, and live config inspection in this file.

## Known Issues

- [x] None blocking
- [ ] Codex restart still required before newly installed skills and MCP changes are picked up by new sessions.

## Sign-off

- [x] Engineering
- [x] Design/PM not applicable
- [x] QA not applicable

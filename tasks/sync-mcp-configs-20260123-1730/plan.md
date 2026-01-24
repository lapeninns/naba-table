---
task: sync-mcp-configs
timestamp_utc: 2026-01-23T17:30:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Sync MCP Configs

## Objective

We will align OpenCode MCP configuration with Codex MCP definitions so OpenCode supports all configured MCP providers without omissions.

## Success Criteria

- [ ] OpenCode config includes all MCP entries present in Codex config.
- [ ] Config values remain schema-valid and secrets are not committed.

## Architecture & Components

- Codex config: `/Users/amankumarshrestha/.codex/config.toml` MCP entries under `[mcp_servers.*]`.
- OpenCode config: `.opencode/config.json` with `mcp` entries per OpenCode schema.

## Data Flow & API Contracts

- Configuration-only change; no API contracts impacted.

## UI/UX States

- None.

## Edge Cases

- Codex config may include MCP entries unsupported by OpenCode schema.
- Existing OpenCode overrides may need preservation.

## Testing Strategy

- Not applicable (config change). Validate via schema or lint if available.

## Rollout

- No rollout plan required; configuration sync only.

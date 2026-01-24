---
task: sync-mcp-configs
timestamp_utc: 2026-01-23T17:30:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Sync MCP Configs

## Requirements

- Functional:
  - Add support for all MCP entries in OpenCode config based on Codex config.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Do not commit secrets; use placeholders or env-based values only.

## Existing Patterns & Reuse

- Codex MCP servers are defined in `/Users/amankumarshrestha/.codex/config.toml` under `[mcp_servers.*]`.
- OpenCode configuration lives in `config/agent.config.yaml` and `config/agent.config.example.yaml`.

## External Resources

- https://opencode.ai/docs/mcp-servers/ — OpenCode MCP config schema and options.

## Constraints & Risks

- Secrets must not be committed.
- Ensure MCP provider definitions remain consistent with existing config schema.

## Open Questions (owner, due)

- Should OpenCode mirror Codex exactly, or only include a subset?

## Recommended Direction (with rationale)

- Mirror Codex MCP entries in OpenCode config using existing schema, keeping secret fields as env placeholders.

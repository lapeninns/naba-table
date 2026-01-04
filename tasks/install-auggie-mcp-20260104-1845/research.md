---
task: install-auggie-mcp
timestamp_utc: 2026-01-04T18:45:00Z
owner: github:@user
reviewers: []
risk: low
flags: []
related_tickets: []
---

# Research: Install Auggie MCP

## Requirements

The user wants to "install mcp in opencode auggie by augment code".

- **Interpretation**: "Auggie" is likely the AI assistant or tool by Augment Code. "OpenCode" is likely the current agent or environment.
- **Goal**: Ensure the Augment Code MCP (Auggie) is available and properly configured/documented in the project.

## Current State

- **Tools**: I have access to `augment-code_codebase-retrieval`, which is described as "Augment's context engine".
- **Docs**: `skills/mcp-integration.md` lists `Context7 MCP` for semantic search. It does not mention "Auggie" or "Augment Code" explicitly by name, though `Context7` might be related.
- **Codebase**: `grep` for "auggie" or "augment" returned nothing in the project files (except `package.json` was listed but I haven't read it yet to check dependencies).

## Hypothesis

"Context7" in `skills/mcp-integration.md` might be an internal name or placeholder for Augment Code. The user might want me to explicitly "install" (configure/document) "Auggie" to replace or supplement this.
Or, the user is asking me to run a command to install it.

## Plan

1. Verify if `augment-code_codebase-retrieval` works.
2. Check `package.json` for any relevant dependencies.
3. Update `skills/mcp-integration.md` and `AGENTS.md` to explicitly list "Auggie (Augment Code)" if it's the intended tool for Codebase Retrieval.

## Open Questions

- Is "Context7" the same as "Augment Code"?
- Does the user want me to install a _new_ MCP server, or just recognize the existing one?

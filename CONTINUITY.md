# Continuity Ledger

Last updated: 2026-01-04T19:20:00Z

## Goal (incl. success criteria)

- Install and configure missing MCP tools: **Next DevTools MCP** and **DeepWiki MCP**.
- Configure the already installed **Supabase MCP**.
- Ensure all required MCPs from `AGENTS.md` are operational.

## Constraints/Assumptions

- Supabase MCP is already installed (`@supabase/mcp-server-supabase`).
- Chrome DevTools MCP is already installed (`chrome-devtools-mcp`).
- "DeepWiki" and "Next DevTools" specific packages need identification.
- Configuration location needs to be identified (likely `.cursor/mcp.json` or similar).

## Key decisions

- (Pending) Selection of packages for Next DevTools and DeepWiki.

## State

- Task folder created: `tasks/install-missing-mcps-20260104-1915`.
- Initial package inventory complete.
- Searching for configuration standards in the repo.

## Done

- Verified `package.json` for existing MCP packages.
- Updated `CONTINUITY.md` with new task.

## Now

- Researching "DeepWiki" and "Next DevTools" package availability.
- Locating MCP configuration file.

## Next

- Create/Update MCP configuration.
- Install missing packages.
- Verify installation.

## Open questions (UNCONFIRMED if needed)

- Is "DeepWiki" a public package or an internal/hallucinated reference?
- Does "Next DevTools MCP" refer to a specific package or just using Next.js features via an MCP wrapper?

## Working set (files/ids/commands)

- `tasks/install-missing-mcps-20260104-1915/`
- `package.json`
- `.vscode/settings.json`

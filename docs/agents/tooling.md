# Agent Tooling

MCP tools and their usage by SDLC phase.

## MCP Catalog

| Tool               | Purpose                                                   | Phases  | Rule                                  |
| ------------------ | --------------------------------------------------------- | ------- | ------------------------------------- |
| Chrome DevTools    | Manual QA (console, network, emulation, Lighthouse, a11y) | 4       | Required for any UI change            |
| Shadcn             | Discover/scaffold UI components                           | 2, 3    | Use before creating custom components |
| Supabase           | Remote migrations, schema drift, rollback                 | 2, 3, 6 | Remote only; connections via secrets  |
| Codebase Retrieval | Semantic search across the repo                           | 1, 2, 3 | Good first step for discovery         |
| Context7           | Up-to-date library documentation                          | 1, 2, 3 | Use for third-party API docs          |

## Shell Practices

- Prefer deterministic, non-interactive commands
- Use `fd` for file search, `rg` for text search
- Use `jq`/`yq` for structured data
- Limit output with `head`; pick single results consistently

## If MCP is Unavailable

Run equivalent CLI/manual steps and attach artifacts. MCP usage is required long-term.

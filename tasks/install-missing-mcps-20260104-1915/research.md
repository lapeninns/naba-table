---
task: install-missing-mcps
timestamp_utc: 2026-01-04T19:25:00Z
owner: github:@maintainers
reviewers: []
risk: medium
flags: []
related_tickets: []
---

# Research: Install Missing MCPs

## Requirements

- Install and configure:
  1. **Next DevTools MCP** (for Phase 2/3)
  2. **Supabase MCP** (for Phase 2/3/6)
  3. **DeepWiki MCP** (for Phase 1)

## Current Status Analysis

### 1. Active Tools (Available to Agent)

- **Context7**: Available (`context7_resolve-library-id`, `context7_query-docs`).
- **Shadcn**: Available (`shadcn_get_project_registries`, etc.).
- **Playwright**: Available (`playwright_browser_...`).

### 2. Installed Packages (in `package.json`)

- **Supabase**: `@supabase/mcp-server-supabase` is present in `dependencies`.
- **Chrome DevTools**: `chrome-devtools-mcp` is present in `devDependencies`.
- **Next**: `next` is present.

### 3. Missing Tools (Not in Agent Tool List)

- **Supabase**: Package exists, but tool is not loaded.
- **Chrome DevTools**: Package exists, but tool is not loaded (Playwright is loaded instead).
- **Next DevTools**: No specific package found, tool not loaded.
- **DeepWiki**: No package found, tool not loaded.

## Findings

1.  **Configuration Gap**: There is no visible MCP configuration file (e.g., `.cursor/mcp.json`, `claude_desktop_config.json`, `mcp-servers.json`) in the repository. This explains why installed packages (Supabase, Chrome DevTools) are not loading as tools.
2.  **Missing Packages**:
    - "Next DevTools MCP": Likely refers to a community package or a custom script. Needs search.
    - "DeepWiki MCP": Likely an external service or a specific package. Needs search.

## Plan Strategy

1.  **Establish Configuration**: Create a standard MCP configuration file (e.g., `mcp.json` or `.vscode/mcp.json`) to register the servers.
2.  **Configure Existing Packages**: Add config entries for `@supabase/mcp-server-supabase` and `chrome-devtools-mcp`.
3.  **Hunt for Missing**:
    - Search npm for `mcp-server-next`, `next-mcp`, `deepwiki-mcp`.
    - If "DeepWiki" cannot be found, document it as a potential documentation hallucination or internal tool that needs a mock/replacement.
    - If "Next DevTools" cannot be found, investigate if `chrome-devtools-mcp` covers the requirement or if a specific Next.js adapter exists.

## Open Questions

- What is the canonical package name for "Next DevTools MCP"?
- Is "DeepWiki" a real public package?

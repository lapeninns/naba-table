---
agents_version: 5.3
scope: subproject
extends: ../../AGENTS.md
last_updated: 2025-12-19
owner: github:@amanshresthaa
profile: web-hooks
---

# AGENTS.md - Hooks (`src/hooks`)

Applies to React hooks under `src/hooks/**`.

## Rules

- Hooks must be named `useSomething` and follow the Rules of Hooks.
- Keep hooks focused; compose smaller hooks instead of one mega-hook.
- Avoid direct DOM manipulation unless absolutely required.

## Layering

UI (`src/components`) -> hooks (`src/hooks`) -> services/contexts (`src/services/ops`, `src/contexts`) -> API/DB

- Do not call Supabase directly from hooks unless there is no shared service.
- Prefer shared types from `src/types`.

## MCP usage

- Chrome DevTools MCP for network/state inspection in UI flows.
- Context7 MCP to find prior hook patterns before adding new ones.

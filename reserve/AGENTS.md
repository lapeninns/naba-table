---
agents_version: 5.3
scope: subproject
extends: ../AGENTS.md
last_updated: 2025-12-19
owner: github:@amanshresthaa
profile: web-vite
---

# AGENTS.md - Reserve app (`reserve`)

Applies to the Vite-powered UI in `reserve/**`.

## Structure

- `app/`, `pages/` - app entry points and routing
- `features/` - feature modules
- `shared/` - shared UI, hooks, utilities

## Commands

- `pnpm reserve:dev`
- `pnpm reserve:build`
- `pnpm storybook`
- `pnpm storybook:build`

## UI rules

- Prefer existing primitives in `reserve/shared/ui`.
- Keep feature logic inside `reserve/features` and share through `reserve/shared`.
- Accessibility and keyboard flows are required.

## MCP usage

- Chrome DevTools MCP is required for UI changes.
- Shadcn MCP if adding new primitives (respect `components.json`).

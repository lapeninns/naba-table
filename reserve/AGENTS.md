---
agents_version: 5.3
scope: subproject
extends: ../AGENTS.md
last_updated: 2025-12-03
owner: github:@web-core
profile: web-vite
---

# AGENTS.md — Reserve SPA (`reserve/`)

> Inherits root `/AGENTS.md`. Applies to the Vite/Storybook Reserve experience under `reserve/**`.

## Overview

- Vite-powered React app with its own aliases (`@reserve`, `@features`, etc.).
- Storybook lives here; output builds to `dist/reserve` (or `RESERVE_BUILD_OUT_DIR`).
- Shares types/paths back to the main app via tsconfig paths; avoid coupling to server-only modules.

## Build & Test Commands (run at repo root)

- `pnpm reserve:dev` — Vite dev server (port 5174).
- `pnpm reserve:build` — production build (respects `RESERVE_BUILD_OUT_DIR`).
- `pnpm storybook` / `pnpm storybook:build` — component sandbox.
- `pnpm test` — runs Vitest suite; keep Reserve tests under `reserve/tests` or colocated.

## Subproject Guidelines

- Prefer existing UI primitives from `reserve/shared` or main `src/components/ui` before adding new ones; document gaps in task `research.md`.
- A11y: follow root rules (keyboard, focus, ARIA); Storybook stories should include at least a default and an error/disabled state for new reusable components.
- Data: no direct secrets; mock external calls in stories/tests. Keep environment access behind helpers.
- Routing: keep path conventions stable; avoid breaking deep links without migration notes.

## Testing & QA

- Vitest for logic; use Playwright component tests if re-enabled.
- For UI changes, run Chrome DevTools MCP on critical Reserve flows and attach artifacts per root policy.

## Deployment & Output

- Build artifacts are static; integrate into parent deploy pipeline as needed. Do not write to production buckets from this package.

## Links

- Root AGENTS: `/AGENTS.md`
- Main app routes: `src/app/**`
- Shared components: `src/components/**`

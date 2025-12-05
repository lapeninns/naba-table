---
agents_version: 5.3
scope: subproject
extends: ../AGENTS.md
last_updated: 2025-12-03
owner: github:@design-systems
profile: package-ui
---

# AGENTS.md — Legacy/Shared Components (`components/`)

> Inherits root `/AGENTS.md`. Applies to top-level components outside `src/components` (marketing, ops shells, atoms, layout helpers).

## Overview

- Contains legacy/shared React components still consumed by the main app (e.g., marketing sections, ops UI, layout primitives).
- Coexists with `src/components`; prefer migrating to `src/components/ui`/`features` when practical.

## Guidelines

- Favor reuse of Shadcn-based primitives; avoid introducing new bespoke styles unless justified in task `plan.md`.
- Keep components presentational; route/data logic should live in hooks/services.
- Maintain accessibility: semantic roles, focus-visible, keyboard support.
- When adding or modifying, note whether component is slated for migration to `src/components` to avoid duplication.

## Build & Test Commands

- `pnpm lint` / `pnpm typecheck` — ensure components compile.
- `pnpm test` — add/maintain tests for interactive pieces where feasible.

## Testing & QA

- For UI changes, run Chrome DevTools MCP (a11y/perf) on affected pages and attach artifacts per root policy.

## Links

- Root AGENTS: `/AGENTS.md`
- Newer components: `src/components/**`
- Hooks: `hooks/**` or `src/hooks/**`

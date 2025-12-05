---
agents_version: 5.3
scope: subproject
extends: ../AGENTS.md
last_updated: 2025-12-03
owner: github:@web-core
profile: web-hooks
---

# AGENTS.md — Legacy Hooks (`hooks/`)

> Inherits root `/AGENTS.md`. Applies to top-level React hooks under `hooks/**` (legacy/shared), distinct from `src/hooks/**`.

## Overview

- Contains shared hooks used across the app (booking flows, session helpers, ops utilities) predating the `src/hooks` move.
- Some hooks proxy to newer logic; avoid divergence.

## Guidelines

- Prefer adding new hooks in `src/hooks`; if touching legacy hooks, consider migration notes in task `plan.md`.
- Follow Rules of Hooks; keep hooks focused and side-effect boundaries clear.
- No direct Supabase/API calls from hooks unless already patterned; prefer services in `lib` or `src/services`.
- Keep typing strict; expose stable return shapes to avoid downstream breakage.

## Build & Test Commands

- `pnpm lint` / `pnpm typecheck` — ensure hook signatures stay sound.
- `pnpm test` — add/maintain tests for non-trivial hooks (loading/error transitions, caching behavior).

## Testing & QA

- For changes affecting network behavior, inspect requests via Chrome DevTools MCP; ensure state transitions and caching work as expected.

## Links

- Root AGENTS: `/AGENTS.md`
- Newer hooks: `src/hooks/**`
- Services: `lib/**`, `src/services/**`

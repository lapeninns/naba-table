---
agents_version: 5.3
scope: subproject
extends: ../AGENTS.md
last_updated: 2025-12-03
owner: github:@core-platform
profile: shared-lib
---

# AGENTS.md — Shared Lib (`lib/`)

> Inherits root `/AGENTS.md`. Applies to shared runtime libraries (auth, supabase, analytics, bookings, queue, utils) under `lib/**`.

## Overview

- Cross-cutting helpers used by both Next app and server jobs (Supabase client setup, auth helpers, analytics, queue wrappers, errors, URLs).
- Must remain framework-agnostic; no React/Next imports.

## Guidelines

- Treat `lib` as a **boundary layer**: validate external inputs, return typed results, and avoid leaking raw errors.
- Keep modules single-purpose; prefer small files over monoliths.
- Supabase/remote calls must honor root remote-only rule and use env-driven configuration (`env.ts`, `env-client.ts`).
- Logging: use shared logger utilities; avoid `console` noise in production paths.
- Do not import from `src/app` or UI components; UI depends on `lib`, not vice versa.

## Build & Test Commands

- `pnpm lint` — lints `lib/**`.
- `pnpm test` — include/extend tests for new modules.
- `pnpm typecheck` — ensure public types remain stable.

## Testing

- Add unit tests for any non-trivial logic (auth guards, booking calc, queue setup). Mock external services; keep tests hermetic.

## Deployment Notes

- Changes here can impact both server and client bundles; note breaking changes in task `plan.md` and consider semver-like caution.

## Links

- Root AGENTS: `/AGENTS.md`
- Supabase config: `lib/supabase/**`
- Queue helpers: `lib/queue/**`

---
agents_version: 5.3
scope: subproject
extends: ../AGENTS.md
last_updated: 2025-12-03
owner: github:@ops-core
profile: service-ts
---

# AGENTS.md — Server (`server/`)

> Inherits root `/AGENTS.md`. Applies to server-side jobs, queues, webhooks, and domain services in `server/**`.

## Overview

- Contains background jobs, queues (`queue/`), alerts/observability, Supabase accessors, and domain services (bookings, restaurants, team, waitlist, webhooks).
- No React/Next code here; keep it framework-agnostic and testable.

## Build & Test Commands (repo root)

- `pnpm lint` — ESLint over server/lib/scripts.
- `pnpm test` — Vitest suite (security/ops smoke tests).
- `pnpm typecheck` — TypeScript type safety for shared/server code.

## Guidelines

- Supabase is **remote only**; never run destructive scripts against prod without approvals. Follow expansion→backfill→contraction.
- Jobs/queues must be idempotent and retry-safe; avoid long locks. Log with correlation IDs where possible.
- Validate inputs at module boundaries; normalize errors (no leaking raw driver errors).
- Secrets/config only via env; never embed keys in code or tests.
- Keep modules small: separate orchestration (jobs) from pure domain logic (services).

## Testing & QA

- Unit tests near code (`__tests__` or sibling files) covering happy path + error cases.
- When changing DB interactions, document plan/rollback in task `plan.md`; capture drift/diff via Supabase MCP where applicable.

## Deployment & Ops

- Respect `APP_ENV`/`DB_TARGET_ENV` safety flags; production actions require documented windows and rollback steps.
- Observe logs/metrics (see `observability/`) and update runbooks when behavior changes.

## Links

- Root AGENTS: `/AGENTS.md`
- Shared types: `src/types/**`
- Supabase helpers: `lib/supabase`, `server/supabase.ts`

---
agents_version: 5.3
scope: subproject
extends: ../AGENTS.md
last_updated: 2025-12-03
owner: github:@core-platform
profile: shared-lib
---

# AGENTS.md — Shared Lib (`lib/`)

> Inherits root `/AGENTS.md`. Applies to shared runtime libraries (auth, Supabase, analytics, bookings, queue, utils) under `lib/**`.

## Overview

- Contains the **core runtime glue** used by both the Next.js app and background workers:
  - Config + env contracts (`env.ts`, `env-client.ts`, `site-url.ts`)
  - Supabase bootstrap + typed clients (`lib/supabase/**`)
  - Auth/session helpers (`auth/**`, `profile/**`)
  - Domain helpers (`bookings/**`, `reservations/**`, `restaurants/**`, `queue/**`)
  - Horizontal utilities (analytics/logger/monitoring/http/security/query/utils)
- Modules must stay framework-agnostic (no React/Next imports) so they can be reused by `server/` jobs and CLI scripts.

## Guidelines

1. **Boundary enforcement**
   - Functions in `lib/**` sit at system boundaries: validate inputs, normalize errors, and return typed responses. Never leak raw driver errors from Supabase or external APIs.
   - Keep modules tight-scoped (e.g., `lib/bookings/availability.ts`, `lib/queue/enqueueBookingReminder.ts`) to avoid entangled dependencies.
2. **Supabase remote-only compliance**
   - All Supabase helpers must read connection details from `env.ts` and assume remote targets. Do not embed local URLs.
   - When changing `lib/supabase/**`, capture the impact on migrations/roles inside the task folder and sync with `supabase/` owners.
3. **Logging & monitoring**
   - Use `lib/logger.ts` + `lib/monitoring/**` for structured events; avoid ad-hoc `console.log` statements in shared code.
4. **No UI coupling**
   - UI/components must depend on `lib`, never the other way around. If you find a React import creeping in, refactor it to `src/hooks` or `src/components`.

## Build Commands

- `pnpm lint lib/**`
- `pnpm typecheck --filter lib`

## Deployment Notes

- These modules are bundled into both client and server builds; flag breaking API changes in the task `plan.md`, especially for `env-client.ts` or shared DTOs consumed by `src/types`.
- For queue/cron helpers, ensure `server/` jobs and `scripts/` are updated simultaneously.

## Links

- Root AGENTS: `/AGENTS.md`
- Supabase config: `lib/supabase/**`
- Queue helpers: `lib/queue/**`
- Analytics/logging: `lib/analytics/**`, `lib/logger.ts`

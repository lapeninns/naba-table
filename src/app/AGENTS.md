---
agents_version: 5.3
scope: subproject
extends: ../../AGENTS.md
last_updated: 2025-11-30
owner: github:@web-core
profile: web-next
---

# AGENTS.md — Application Routes (`src/app`)

> Inherits root `/AGENTS.md`. Applies to all Next.js routes, layouts, and route handlers under `src/app/**`.

---

## Overview

This directory contains the primary **Next.js App Router** surface:

- Route groups:
  - `src/app/(public)` — public/marketing surfaces (e.g., `(marketing)`, `auth`, `bookings`, `page.tsx`).
  - `src/app/guest` — guest‑facing booking + dashboard flows.
  - `src/app/app` — internal “app” area (logged‑in operations, etc.).
- API routes:
  - `src/app/api/**` — route handlers for app, auth, availability, bookings, config, events, lead, ops, profile, reservations, restaurants, staff, team, etc.
- Global shell:
  - `src/app/layout.tsx`, `src/app/error.tsx`, `src/app/not-found.tsx`, `src/app/providers.tsx`
  - `src/app/robots.ts`, `src/app/sitemap.ts`
  - `src/app/globals.css` (and backups)

All UI/a11y/perf rules in the root `AGENTS.md` apply here, plus the additional constraints below.

---

## Build & Test Commands

> Update these to match your actual `package.json` scripts if they differ.

From the repo root:

- `pnpm install` — install dependencies
- `pnpm run dev` — run the dev server
- `pnpm run build` — production build
- `pnpm run lint` — lint
- `pnpm run test` — run tests (unit/integration)
- `pnpm run test:e2e` — run E2E tests (if configured)

---

## Routing & Layout Rules

- **App Router conventions**
  - Use route groups (e.g. `(public)`, `(marketing)`) intentionally to separate concerns.
  - Keep **top‑level segments stable** where they map to external URLs (e.g. guest flows, booking links).
- **Layouts**
  - `src/app/layout.tsx` defines the main shell; do not add heavy, route‑specific logic here.
  - Use nested `layout.tsx` files per segment (e.g. under `guest/`) for scoped shells.
- **Error & not‑found**
  - `error.tsx` must be resilient (no data dependencies that can fail again).
  - `not-found.tsx` should render a lightweight, accessible 404 page.

When adding new routes:

1. Choose the correct segment group (`(public)`, `guest`, `app`) based on the user and auth model.
2. Wire routing state (params, search params) into components via props or hooks — don’t parse `window.location` manually.
3. Ensure **loading**, **empty**, **error**, and **success** states are explicitly implemented.

---

## API Route Rules (`src/app/api/**`)

Route handlers here are **system boundaries** — they _should_ validate inputs and protect invariants, even though internal code is trusted elsewhere.

- **Input validation**
  - Parse and validate incoming JSON/query/body at the route boundary.
  - Fail with clear, structured error responses (status + machine‑readable code).
- **Auth & authz**
  - Enforce auth checks consistently (shared helpers if available).
  - Never rely solely on client‑side enforcement for access control.
- **Error handling**
  - Normalize errors (e.g. known domain errors vs generic 500).
  - Avoid leaking sensitive details in error messages.
- **Logging & observability**
  - Log failures in a structured way (correlation IDs, key fields) where supported.

Follow the **Supabase remote‑only** rule from root when these handlers talk to the database.

---

## UI / Page‑Level Rules

- Use **feature components** from `src/components/features/**` and **contexts/hooks** from `src/contexts` / `src/hooks` instead of putting complex domain logic directly in `page.tsx`.
- Keep `page.tsx` files mostly as **composition + wiring**:
  - Data loading / suspense boundaries
  - Layout selection
  - Passing props into shared components
- For **guest booking flows** under `src/app/guest`:
  - Prioritize **perf & resiliency** (mobile‑heavy traffic).
  - Ensure all flows are fully **keyboard accessible** and have a clear error path.
  - Do not break bookmarked deep links (thank‑you pages, dashboard, etc.) without a migration plan.

---

## MCP Usage in `src/app`

In addition to root MCP rules:

- **Chrome DevTools MCP** (Phase 4 — required for UI changes)
  - Run Lighthouse and basic a11y checks against relevant routes.
  - Capture HAR + screenshots for critical flows (especially guest bookings, auth).
- **Shadcn MCP**
  - Use for designing and scaffolding UI components that will live in `src/components`.
- **Next DevTools MCP**
  - Use when:
    - Adding or modifying routes/segments.
    - Changing data‑fetching strategies (server actions, RSC vs client).
    - Investigating bundle size or waterfalls.

Document MCP usage outcomes in the task’s `verification.md` per root policy.

---

## Links

- Root AGENTS: `/AGENTS.md`
- Shared components: `src/components/**`
- Hooks: `src/hooks/**`
- Ops services: `src/services/ops/**`
- Types: `src/types/ops.ts`

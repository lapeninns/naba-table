---
agents_version: 5.4
scope: subproject
extends: ../../AGENTS.md
last_updated: 2026-02-06
owner: github:@guest-experience
profile: guest-app
---

# AGENTS.md — Guest Experience (`src/guest`)

> Inherits root `/AGENTS.md`. Applies to guest-specific hooks, layouts, lib helpers, routes, and services consumed by the guest dashboard & booking flows.

## Overview

- `hooks/` — guest-only data/state hooks (booking timelines, reservations, profile, notifications).
- `layouts/` — layout shells for guest flows (dashboards, booking wizard wrappers, thank-you pages).
- `lib/` — guest-specific utilities (formatters, guards, state helpers).
- `routes/` — helper modules coordinating navigation, deeplinks, and route metadata.
- `services/` — guest-facing API clients (reservations, schedule, messaging, etc.).

These modules back the **public booking + guest portal** under `src/app/(public)` and `src/app/guest/**`. Treat all outputs as user-visible and mobile-first.

## Build Commands

- `pnpm run dev` — smoke-test guest scenarios locally.
- `pnpm run lint` / `pnpm run typecheck` — required before submitting changes.

## Guidelines

1. **A11y & Mobile-First**
   - Always cover mobile breakpoints first; ensure layouts respect safe areas and responsive typography.
   - Provide accessible names/labels (`aria-live` for booking updates, focus management between steps) per root policy.
2. **Deep Links & URL State**
   - Keep guest URLs stable (`/guest/bookings/:id`, `/guest/dashboard`). Use helpers in `routes/` to centralize slug/param changes.
   - When adjusting URL schemas, document migration/redirect plan in the task folder.
3. **Data & Caching**
   - Hooks should consume shared fetchers/services; avoid duplicating API logic.
   - Memoize expensive transforms (timeline merges, calendar slot building) to avoid regressions on low-end devices.
4. **Security & Privacy**
   - Never expose internal IDs or ops-only data in guest responses/logs.
   - Sanitize query param input; guard unauthorized access in services/hooks.
5. **State Machines & Error Paths**
   - All flows must implement loading/empty/error/success states with actionable messaging.
   - Provide retry hooks and offline-friendly cues when possible (tie into `booking-offline-queue` as needed).

## Links

- Root AGENTS: `/AGENTS.md`
- App routes: `src/app/(public)/**`, `src/app/guest/**`
- Shared hooks: `src/hooks/**`
- Context providers: `src/contexts/**`

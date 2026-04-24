---
agents_version: 5.4
scope: subproject
extends: ../../AGENTS.md
last_updated: 2026-04-24
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

## Radix Luma Design System

Guest-facing visual work must follow the **Radix Luma** design system. Source of truth:

- **Design spec:** `GUEST_FACING_DESIGN_SYSTEM.md` (repo root)
- **Implementation map:** `docs/design-system/public-guest.md`
- **Guest tokens:** `styles/design-system/public-guest.tokens.css`
- **Guest utilities:** `styles/design-system/public-guest.utilities.css`
- **Guest compounds:** `src/components/guest/ui/**`
- **Shadcn primitives:** `components/ui/**`

### Key Constraints

- Scope: guest routes, public booking, guest portal. Not ops routes under `src/app/app/**`.
- Keep styling inside `.guest-theme` / `[data-theme='guest']` boundary.
- Zinc neutrals + cobalt accent `#1447E6` only. No extra color palettes for guest surfaces.
- Merriweather for headlines, Inter for body, Geist Mono for metadata.
- Shadcn/Radix primitives first, always. Custom compounds only when composed from existing primitives.
- Cards: border-only rest state. Hover lift only on interactive cards.
- Buttons: capsule-shaped. Limit filled primary to main CTA(s).

## Verification

- Chrome DevTools MCP proof required per root policy.
- Minimum browser proof: mobile viewport + the specific guest/public route changed.
- Static checks: ESLint, `pnpm typecheck`, Prettier. CSS parse/import checks when design-system CSS is touched.

## Build Commands

- `pnpm run dev` — smoke-test guest scenarios locally.
- `pnpm run lint` / `pnpm run typecheck` — required before submitting changes.

## Guidelines

- Mobile-first always; safe areas and responsive typography.
- Accessible names/labels, `aria-live` for booking updates, focus management between steps.
- Keep guest URLs stable; centralize slug/param changes in `routes/`.
- Hooks consume shared fetchers/services; memoize expensive transforms.
- Never expose internal IDs or ops-only data in guest responses/logs.
- All flows: loading/empty/error/success states with actionable messaging.

## Links

- Root AGENTS: `/AGENTS.md`
- App routes: `src/app/(public)/**`, `src/app/guest/**`
- Shared hooks: `src/hooks/**`
- Context providers: `src/contexts/**`

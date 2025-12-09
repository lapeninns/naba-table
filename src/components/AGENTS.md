---
agents_version: 5.3
scope: subproject
extends: ../../AGENTS.md
last_updated: 2025-11-30
owner: github:@design-systems
profile: package-ui
---

# AGENTS.md — Components (`src/components`)

> Inherits root `/AGENTS.md`. Applies to all shared and feature components under `src/components/**`.

---

## Overview

This directory contains **React components** used across the app:

- `auth/` — auth‑specific UI (e.g., `SignInForm.tsx`)
- `common/` — generic shared exports
- `features/` — feature‑scoped components (`booking`, `dashboard`, `guest`, `ops-shell`, `restaurant-settings`, `tables`, `team`, etc.)
- `landing/`, `marketing/` — marketing and public surfaces
- `layout/`, `layouts/` — layout shells (`AuthLayout`, `GuestLayout`, `MarketingLayout`, headers)
- `shared/` — marketing/shared primitives (`FeatureCard`, `PageHero`, `PageSection`)
- `ui/` — Shadcn‑based UI primitives (buttons, inputs, etc.)

---

## Layering & Responsibilities

- **`components/ui` (Shadcn primitives)**
  - No domain knowledge; purely presentational and behaviorally generic.
  - Extends Shadcn patterns (via Shadcn MCP) with consistent tokens and a11y.
  - No direct data fetching or routing logic.
- **`components/layouts` / `components/layout`**
  - Define structural shells (header, main, footers).
  - No business logic; only glue and layout responsibilities.
- **`components/features/**`\*\*
  - Feature‑scoped UI: can know about domain concepts (bookings, guests, ops).
  - Should still receive **data via props or hooks**, not perform raw API calls.
  - Keep side‑effects out; delegate to hooks (`src/hooks`) or services (`src/services/ops`).
- **`components/landing`, `components/marketing`, `components/shared`**
  - Reusable marketing/presentation pieces.
  - Avoid coupling these to logged‑in app state or ops‑specific services.

---

## Code Conventions

- Components are **function components** with TypeScript props interfaces/types.
- Prefer **composition over inheritance**:
  - Wrap primitives from `components/ui` rather than re‑implement.
- A11y:
  - Respect semantics from root AGENTS (roles, ARIA, focus management).
  - For complex widgets (menus, dialogs, sheets, comboboxes), follow WAI‑ARIA APG.
- Styling:
  - **Follow `DesignSystem.md` strictly**: Use the shared design tokens, logic, and custom styles defined in `DesignSystem.md`.
  - Use Tailwind utilities / CSS modules per repo standard where consistent with the design system.
  - Avoid inline styles except for rare one‑off cases.

---

## Testing

- **Unit tests**
  - At minimum for complex or critical components (forms, modals, interactive widgets).
  - Co‑locate tests (e.g., `ComponentName.test.tsx` or `__tests__/ComponentName.test.tsx`) following existing conventions.
- **Visual/Storybook**
  - If Storybook (or similar) is configured, new reusable components should ship with a basic story:
    - Default state
    - Error/disabled state (if applicable)
    - Any key visual variations
- **Accessibility**
  - Components used in multiple flows should be periodically checked with axe (or equivalent).
  - For new primitives and major feature UIs, record a11y notes in `verification.md` for the task.

---

## When to Add vs Reuse

Before creating a new component:

1. Search `src/components` (especially `ui/`, `shared/`, and `features/`) for an existing pattern.
2. If a component is almost right:
   - Consider extending it or making it more flexible _without_ breaking existing uses.
3. Only create a new primitive in `ui/` when:
   - There is no Shadcn equivalent, **and**
   - The component is likely to be reused across features.

Record “reuse or no reusable pattern” in the task’s `research.md` (DoR requirement).

---

## MCP Usage in `src/components`

- Use **Shadcn MCP** to:
  - Discover the appropriate primitive or pattern.
  - Scaffold new components into `components/ui` with correct a11y patterns.
- Use **Chrome DevTools MCP** (Phase 4) to validate:
  - Focus states
  - Keyboard navigation
  - Layout behavior across breakpoints for components introduced/changed here.

---

## Links

- Root AGENTS: `/AGENTS.md`
- App routes: `src/app/**`
- Hooks: `src/hooks/**`
- Design tokens / global styles: `src/app/globals.css`

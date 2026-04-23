---
agents_version: 5.4
scope: subproject
extends: ../../AGENTS.md
last_updated: 2026-04-23
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

Guest-facing visual work must follow the repo-root `GUEST_FACING_DESIGN_SYSTEM.md` (Radix Luma), copied from `/Users/amankumarshrestha/NewShadcn/DESIGN.md`. Keep shared styling inside the `.guest-theme` / `[data-theme='guest']` boundary so ops-facing routes remain on the app design system.

## Radix Luma Design Contract

Radix Luma is the mandatory design system for guest-facing routes, guest portal states, public booking flows, and guest reusable compounds. Treat the repo-root `GUEST_FACING_DESIGN_SYSTEM.md` as the design source of truth and `docs/design-system/public-guest.md` as the implementation map.

### Scope

- Applies to guest route helpers in `src/guest/**`.
- Applies to consumers under `src/app/(public)/**`, `src/app/guest/**`, `src/components/guest/ui/**`, `src/components/features/booking/**`, `src/components/features/guest/**`, `src/components/restaurants/**`, and homepage/public marketing components when they render guest-facing UI.
- Does not apply to authenticated operator routes under `src/app/app/**` or ops feature components unless a separate ops design-system task explicitly says so.

### Source Files

- Root design source: `GUEST_FACING_DESIGN_SYSTEM.md`.
- Guest token layer: `styles/design-system/public-guest.tokens.css`.
- Guest utility layer: `styles/design-system/public-guest.utilities.css`.
- Guest compatibility bridge: `styles/design-system/public-guest.bridge.css`.
- Shared guest compounds: `src/components/guest/ui/**`.
- Shadcn primitives: `components/ui/**`.

### Visual Rules

- Use Zinc neutrals and the singular cobalt accent `#1447E6`; do not introduce separate blue, amber, violet, coral, or warm-gray palettes for guest surfaces.
- Light mode is the default appearance. Dark mode must be explicitly re-tuned, not inverted.
- Use Merriweather only for display/headline tiers, Inter for interface/body text, and Geist Mono for metadata, technical labels, codes, and tabular values.
- Use semantic colors by role: `primary` only for CTAs, active states, focus rings, and interactive highlights; `destructive` only for errors or destructive actions.
- Do not rely on color alone for meaning. Pair error/active/success states with icon, text, shape, or weight.
- Do not use random dark sections in otherwise light guest pages. Use Zinc tonal layers, borders, panels, or subtle cobalt glow instead.

### Layout Rules

- Build mobile-first and use `min-h-[100dvh]` for full-height guest panels; never use `h-screen`.
- Use `pg-container`, `pg-container-sm`, `pg-section`, `pg-section-tight`, `pg-grid`, `pg-card`, `pg-panel`, `pg-chip`, `pg-hero-title`, `pg-section-title`, and `pg-lead` before adding new one-off classes.
- Constrain body copy to roughly `65ch` and use fluid `clamp()` sizing through the existing guest tokens/utilities rather than discrete breakpoint jumps.
- Use CSS Grid for multi-column guest layouts. Prefer asymmetric 5/7 or 7/5 splits and bento-style hierarchy; avoid generic three-equal-card rows unless content truly has equal weight.
- Maintain 44px minimum touch targets and at least 8px separation for adjacent tap targets.

### Components & Styling

- Components are shadcn/Radix-first, always. Start with installed primitives in `components/ui/**` and compose them before writing custom markup.
- Custom guest components are allowed only as product-specific compounds composed from shadcn/Radix primitives, existing guest utilities, and semantic tokens. Do not create new primitive/base component systems inside `src/guest/**`.
- Put reusable guest/public compounds in `src/components/guest/ui/**` when at least two guest/public surfaces need the pattern; keep one-off layout composition beside the page or feature that owns it.
- Use shadcn variants before custom classes (`variant`, `size`, `asChild`, standard subcomponents). Prefer `Button`, `Card`, `Badge`, `Alert`, `Skeleton`, `Separator`, `Dialog`, `Sheet`, `Popover`, `Tabs`, `Select`, `Input`, `Textarea`, `Checkbox`, `Switch`, and `Table` instead of hand-rolled equivalents.
- If a needed primitive is missing, use the shadcn skill/plugin workflow and the project package runner (`pnpm dlx shadcn@latest ...`) to inspect, search, view docs, and add/update components. Do not manually fetch registry files or paste raw upstream component code.
- Before adding or updating shadcn components, run or consult `pnpm dlx shadcn@latest info`, check installed components, use `pnpm dlx shadcn@latest docs <component>` for APIs/examples, and use `--dry-run` / `--diff` for updates where local changes may exist.
- Use shadcn MCP/plugin tooling where available for discovery, docs, registry inspection, and component generation; fall back to the shadcn CLI only when MCP/plugin tooling is unavailable or insufficient.
- Keep token changes scoped to `.guest-theme` / `[data-theme='guest']`.
- Prefer extending `styles/design-system/public-guest.utilities.css` for new reusable guest utilities and `styles/design-system/public-guest.bridge.css` only for compatibility with existing legacy classes.
- Cards rest with border-only edge definition. Add hover lift only to interactive cards, never static informational containers.
- Buttons are capsule-shaped and tactile. Limit prominent filled primary buttons to the main action(s) on a view; use secondary, outline, ghost, or link styles for supporting actions.
- Inputs use static labels above fields, 36px visual height minimum, visible focus rings, and inline error text.

### Motion & Accessibility

- Motion must be brief, precise, and purposeful. Use transform/opacity only for animation.
- Respect `prefers-reduced-motion`; remove stagger/reveal motion or reduce it to opacity-only.
- Preserve visible `:focus-visible` states and logical keyboard order.
- Every loading, empty, error, success, offline, and auth-gated state must be designed, accessible, and actionable.
- Error states use destructive color sparingly and must include clear text, not only red styling.

### Copy & Product Fit

- Guest-facing copy should be specific, calm, and operationally clear. Avoid generic hype words and placeholder language.
- Public booking and guest portal copy should preserve exact restaurant names, reservation labels, dates, prices, and route language from source data.
- Auth-gated redirects must preserve the intended guest path via `redirectedFrom` where applicable.

### Verification

- UI changes require Chrome DevTools MCP proof per root policy.
- Minimum browser proof for guest visual changes: mobile viewport, homepage or public booking route, and the specific guest/public route changed.
- If a guest route is auth-gated, verify the real redirect/auth surface or use a dev-only harness with the root-policy guard.
- Static checks for guest visual changes should include focused ESLint, `pnpm typecheck`, Prettier, and CSS parse/import checks when design-system CSS is touched.

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

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
- Prefer extending `styles/design-system/public-guest.utilities.css` for new reusable guest utilities; avoid introducing compatibility-only legacy class layers.
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

### Guest Webpage Usefulness Checklist

For every guest/public webpage, run this as a yes/no checklist during planning and again before verification. The page should feel useful, scannable, and free of sections that do not help the user understand, decide, or act. This guidance synthesizes Apple HIG direction on clear hierarchy and labels, GOV.UK direction on user needs/plain language/journey order, and NN/g direction on visual hierarchy, progressive disclosure, accordions, and form cognitive load.

#### Purpose

- Is it immediately clear what this page is for?
- Is it clear who this page is for?
- Is there one primary action the page is trying to drive?
- Are secondary actions clearly secondary?

#### Section Usefulness

- Does every section explain, reassure, or help the user act?
- If a section disappeared, would the page still work just as well?
- Are there any "company says about itself" blocks that do not help the user decide or complete the task?
- Is duplicate information removed?

#### Content & Copy

- Does the main heading say what the page offers?
- Do section headings help scanning?
- Do buttons say exactly what happens next?
- Is the copy plain, direct, and short?
- Are clever labels replaced with obvious ones?

#### Visual Hierarchy

- Is the most important thing visually strongest?
- Is the page easy to scan top to bottom?
- Are related items grouped together with spacing?
- Is there enough contrast between primary and secondary content?
- Do users know where to look first, second, and third?

#### Flow & Order

- Is information presented in the order the user needs it?
- Does the page answer the obvious next question before moving on?
- Is the next step visible without hunting?
- Are users ever left at a dead end?

#### Navigation & Choice

- Are the main choices limited and easy to distinguish?
- Is navigation predictable?
- Are advanced or rare options hidden until needed?
- Are menus and tabs used to reduce clutter, not create it?

#### Accordions, Tabs & Hidden Content

- Is hidden content truly secondary?
- Would most users need to open only one or two sections, not many?
- Are you hiding content to reduce clutter, not to avoid making decisions?

#### Forms & Conversion Points

- Are you asking only for information that is necessary?
- Are labels always visible and clear?
- Is help text placed where it is needed?
- Are error messages close to the field and written plainly?
- Does the submit button say the real action?

#### Final Prune Test

- Does this block help the user understand?
- Does this block help the user decide?
- Does this block help the user do?
- If the answer is no to all three, cut it.

Compact rule: one page equals one main goal, one main CTA, clear heading, strong hierarchy, plain labels, secondary details hidden until needed, and no section without a job.

Reference guidance:

- Apple Human Interface Guidelines: `https://developer.apple.com/design/human-interface-guidelines`
- Apple HIG Writing: `https://developer.apple.com/design/human-interface-guidelines/writing`
- GOV.UK User Needs: `https://www.gov.uk/guidance/content-design/user-needs`
- GOV.UK smooth user journeys: `https://insidegovuk.blog.gov.uk/2013/12/30/6-principles-for-smooth-user-journey/`
- NN/g visual hierarchy: `https://www.nngroup.com/articles/visual-hierarchy-ux-definition/`
- NN/g progressive disclosure: `https://www.nngroup.com/articles/progressive-disclosure/`
- NN/g accordions on desktop: `https://www.nngroup.com/articles/accordions-on-desktop/`
- NN/g reducing cognitive load in forms: `https://www.nngroup.com/articles/4-principles-reduce-cognitive-load/`

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

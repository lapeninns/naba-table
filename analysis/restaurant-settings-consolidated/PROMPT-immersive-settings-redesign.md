# Nabatable — Immersive Restaurant Settings Command Center (Final Aligned Prompt)

**Version:** token-aligned · Nabatable Ops app theme · Shadcn/Luma
**Target:** `https://app.nabatable.com/settings/restaurant/*` (local: `http://app.localhost:3000/settings/restaurant/*`)

**Source bundles:** `analysis/restaurant-settings-consolidated/` · see `manifest.json`

---

## Role

You are an expert UI/UX frontend engineer. Refactor the **existing** Nabatable Ops restaurant settings into an **Immersive Settings Command Center** — elevated hierarchy and motion, **without** breaking behavior or inventing a parallel design system.

Aesthetic reference: Linear / Vercel / Stripe **density and clarity**, expressed through **Nabatable semantic tokens** (not raw Tailwind marketing palettes).

---

## Non-negotiables (repo contract)

1. **Shadcn/ui-first** — Compose only `components/ui/*` primitives. No raw `<button>`, `<input>`, or duplicate component libraries. Gate: `pnpm node scripts/check-no-shadcn.mjs --primitives-only`.
2. **Semantic tokens only** — Use `bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-muted`, `bg-primary`, `ring-ring`, `text-destructive`, etc. **Do not** hardcode `slate-*`, `blue-600`, or guest-theme colors on ops settings.
3. **Radix Luma theme** — Ops and guest share one shadcn theme (`AGENTS.md`). App host uses `data-theme="app"` (neutral/professional, compact).
4. **Preserve behavior** — Keep React Query hooks, `useOpsSession`, `useOpsActiveMembership`, mutations, Zod/validation, GBP field badges, `DualSyncShell` on GBP route, and section save contracts unless you explicitly unify dirty state (see below).
5. **Routing** — External: `/settings/restaurant/*`. Internal: `/app/settings/restaurant/*`. Links via `opsHref()`.
6. **Do not replace global Ops chrome** — Bookings sidebar, top bar, restaurant switcher stay as-is.
7. **Browser verification** — Validate on real app-host routes; `/dev/**` harnesses are supplements only.

---

## Design system references (read before coding)

| Resource                                                                       | Purpose                                                |
| ------------------------------------------------------------------------------ | ------------------------------------------------------ |
| `docs/DESIGN_TOKENS.md`                                                        | Semantic color, radius, motion tokens                  |
| `docs/design-system.md`                                                        | App vs guest themes, foundations                       |
| `src/app/globals.css`                                                          | `:root` / `.dark` CSS variables                        |
| `styles/themes/app.css`                                                        | Compact app density (`--app-text-*`, `--card-padding`) |
| `src/components/features/ops-shell/patterns/opsDensityClasses.ts`              | `OPS_CARD_*`, `OPS_PAGE_RHYTHM_CLASS`                  |
| `src/components/features/restaurant-settings/shared/compactSettingsClasses.ts` | Settings-specific density, sticky actions              |

---

## Scope

### Primary nav (one JSON bundle each)

| URL                                            | View                      | Bundle                                |
| ---------------------------------------------- | ------------------------- | ------------------------------------- |
| `/settings/restaurant`                         | `overview`                | `routes/overview.json`                |
| `/settings/restaurant/profile`                 | `profile`                 | `routes/profile.json`                 |
| `/settings/restaurant/google-business-profile` | `google-business-profile` | `routes/google-business-profile.json` |
| `/settings/restaurant/availability`            | `availability`            | `routes/availability.json`            |
| `/settings/restaurant/menu`                    | `menu`                    | `routes/menu.json`                    |
| `/settings/restaurant/tables`                  | `tables`                  | `routes/tables.json`                  |
| `/settings/restaurant/team`                    | `team`                    | `routes/team.json`                    |

### Legacy aliases (same UI as availability — one bundle)

`/service-periods`, `/operating-hours`, `/turn-durations`, `/occasions` → included in `availability.json`

### Redirect stub (no full redesign)

`/settings/restaurant/email-templates` → redirects to `/email-templates`

### Shared shell (refactor once)

- `RestaurantSettingsPageShell.tsx`
- `RestaurantSettingsSubnav.tsx`
- `shared/RestaurantSettingsCommandCenter.tsx`
- `shared/SettingsCard.tsx`, `SettingsSectionHeader.tsx`, `compactSettingsClasses.ts`
- `routes.ts`

Full tree: `all-routes.json`

---

## Architecture (three tiers mapped to Nabatable)

| Tier               | Do **not** build                | Implement via                                   |
| ------------------ | ------------------------------- | ----------------------------------------------- |
| **1 — Global**     | New dark icon rail              | Existing Ops app layout / sidebar               |
| **2 — Contextual** | Orphan nav list                 | Upgrade `RestaurantSettingsSubnav`              |
| **3 — Main**       | `h-screen` page replacing shell | `OpsPageShell` + scrollable main + view content |

### Page container

Use existing ops shell — do **not** bypass `max-w-[1200px]` and `--pg-gutter` unless product approves full-bleed.

```tsx
// RestaurantSettingsPageShell (conceptual)
<OpsPageShell variant="standard" className={OPS_PAGE_RHYTHM_CLASS}>
  <OpsPageHeader eyebrow="Settings" title={...} subtitle={...} meta={restaurantBadge} />
  <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row lg:gap-6">
    <RestaurantSettingsSubnav className="lg:w-72 lg:shrink-0" />
    <motion.main className="min-w-0 flex-1 overflow-y-auto">
      {children}
    </motion.main>
  </motion.div>
</OpsPageShell>
```

For pane-locked experiences (heavy availability editor), consider `OpsPageShell variant="immersive"` (`h-[calc(100vh-3.5rem)] overflow-hidden`) per `OpsPageShell.tsx`.

**Scrolling:** Prefer `overflow-y-auto` on the **main pane**, not `window` / document scroll.

### Page header

Use `OpsPageHeader` (already token-based):

- Title: `text-2xl font-bold tracking-tight text-foreground` (default h1; sm:`text-3xl` only if needed)
- Subtitle: `text-sm text-muted-foreground`
- Eyebrow: `text-xs uppercase tracking-wide text-muted-foreground`
- Meta: active restaurant `Badge variant="outline"`

---

## Visual language (token-aligned)

### Surfaces

| Role                        | Classes                                                                              |
| --------------------------- | ------------------------------------------------------------------------------------ |
| Page / pane background      | `bg-background`                                                                      |
| Elevated card               | `bg-card text-card-foreground`                                                       |
| Subtle inset / header strip | `bg-muted/30` or `bg-muted/50`                                                       |
| Borders                     | `border-border` or `border-border/60` / `border-border/70` (match existing settings) |
| Secondary text              | `text-muted-foreground`                                                              |
| Primary text                | `text-foreground`                                                                    |

### Settings cards

Extend `SettingsCard` and `RestaurantSettingsCommandCenter` — do not invent a second card primitive.

| Part        | Token-aligned classes                                                                          |
| ----------- | ---------------------------------------------------------------------------------------------- |
| Card shell  | `cn(OPS_CARD_CLASS, 'w-full')` → typically `border-border/70 shadow-none` or light `shadow-sm` |
| Radius      | `rounded-lg` or `rounded-xl` (align with `--radius-lg`; avoid `rounded-3xl` on ops)            |
| Header      | `OPS_CARD_HEADER_CLASS` + optional `bg-muted/30 border-b border-border`                        |
| Title       | `CardTitle` · `text-base` or `text-lg font-semibold text-foreground`                           |
| Description | `CardDescription` · `text-xs` or `text-sm text-muted-foreground`                               |
| Content     | `OPS_CARD_CONTENT_CLASS` · `space-y-4` or `space-y-6`                                          |
| Footer      | `OPS_CARD_FOOTER_CLASS` or `SETTINGS_COMPACT_STICKY_ACTION_ROW_CLASS` when sticky              |

### Forms & inputs (Shadcn)

Apply via `className` on `Input`, `Textarea`, `Select`, `Switch`, `Label`:

```
h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm
placeholder:text-muted-foreground
focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50
```

- Labels: `text-sm font-medium text-foreground`
- Helper: `SETTINGS_COMPACT_HELPER_TEXT_CLASS` or `text-xs leading-relaxed text-muted-foreground mt-1.5`
- Errors: `text-destructive` + `aria-invalid` + `border-destructive focus-visible:ring-destructive/20`

Respect global **44px min touch target** on interactive controls where base CSS applies (`globals.css`).

### Buttons (Shadcn `Button`)

| Variant       | Usage                                                                  |
| ------------- | ---------------------------------------------------------------------- |
| `default`     | Primary save / main CTA → maps to `bg-primary text-primary-foreground` |
| `outline`     | Secondary / cancel                                                     |
| `ghost`       | Tertiary, icon triggers                                                |
| `destructive` | Delete / disconnect                                                    |

Add polish with motion-safe micro-interaction: `motion-safe:active:scale-[0.98]` (optional).

**Do not** use `bg-slate-900` or `bg-blue-600` directly.

### Badges

Use Shadcn `Badge`: `variant="outline"` or `secondary` for status; GBP/status chips stay on existing patterns.

### Icons

`lucide-react` only. Reuse nav icons from `RestaurantSettingsSubnav.tsx` (`NAV_ICONS`).

### Motion

```tsx
import { motion, useReducedMotion } from 'motion/react';
```

- Wrap enter/exit UI in `motion.*`; honor `useReducedMotion()` (skip/limit animation when true).
- Tab indicator: `layoutId="restaurant-settings-tab-indicator"` on underline inside Shadcn `Tabs`.
- Subnav hover: keep existing `motion-safe:hover:-translate-y-[1px]` pattern where appropriate.

---

## State & interactions

### Unsaved changes

Prefer existing **`useRegisterOpsUnsavedChanges`** / `ops-unsaved-changes` context.

When dirty:

1. Register sections with the context (do not duplicate global state ad hoc).
2. Show a **floating command bar inside the settings main pane** (not over global ops sidebar):

```
absolute bottom-4 left-1/2 z-30 -translate-x-1/2
w-[calc(100%-2rem)] max-w-2xl
rounded-xl border border-border bg-foreground text-background shadow-lg
p-4 flex items-center justify-between gap-3
```

Motion (if reduced motion off):

```tsx
initial={{ y: 24, opacity: 0 }}
animate={{ y: 0, opacity: 1 }}
exit={{ y: 24, opacity: 0 }}
```

Actions: **Discard** (`Button variant="outline"` inverted or `secondary`), **Save** (`Button` on dark bar using `className` override for contrast).

Alternatively extend `SETTINGS_COMPACT_STICKY_ACTION_ROW_CLASS` for per-card footers when section-scoped save must remain (profile subforms).

### Subnav (Tier 2)

- Rail: `hidden lg:flex lg:w-72 lg:flex-col lg:border-r lg:border-border lg:bg-muted/20`
- Item active: `bg-background text-foreground shadow-sm ring-1 ring-border`
- Item inactive: `text-muted-foreground hover:bg-background/70 hover:text-foreground hover:ring-1 hover:ring-border`
- Optional active accent: `border-l-2 border-primary` (not `blue-600`)

### Loading / empty / error

- `Skeleton` from shadcn for pending states
- `OpsEmptyState` for zero-data
- React Query `isPending` / `isError` — no layout shift; use `StaleBoundary` on content only per `docs/sdlc/react-query-swr-ux.md`

---

## Per-route guidance

| Route            | Focus                                                                                                                                                             |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Overview**     | `RestaurantSetupOverview` — readiness metrics, checklist cards linking via `opsHref`, command center hero                                                         |
| **Profile**      | `RestaurantProfileSection` — workflow rail (brand, contact, booking rules, notifications, discovery); `RestaurantDetailsForm` in `SettingsCard`s; keep GBP badges |
| **GBP**          | Connection UI + `DualSyncShell` below fold in cards; do not remove sync behavior                                                                                  |
| **Availability** | `AvailabilityOccasionsCommandCenter` — tabs/rail for hours, overrides, periods, occasions, turn bands; card per major section                                     |
| **Menu**         | Wrap `OpsMenuManagementClient` with command center header + `bg-card` workspace                                                                                   |
| **Tables**       | Wrap `TableInventoryClient`; preserve timeline/inventory patterns                                                                                                 |
| **Team**         | `OpsTeamManagementClient` — invite card + invites table card                                                                                                      |

---

## Implementation order

1. Shared: `compactSettingsClasses.ts`, `RestaurantSettingsCommandCenter`, `SettingsCard`, `RestaurantSettingsSubnav`, `RestaurantSettingsPageShell`
2. Overview → Profile → Availability → Menu → Tables → Team → GBP
3. Browser pass: every primary nav URL on app host

---

## Deliverables

- Production TSX under `src/components/features/restaurant-settings/**` (+ `menu/`, `tables/`, `team/` as needed)
- List every file changed
- No secrets in logs; no committed analysis JSON unless asked
- TypeScript strict; preserve `'use client'` boundaries

---

## Copy-paste prompt (single route)

```text
You are an expert UI/UX frontend engineer refactoring Nabatable Ops restaurant settings into an Immersive Settings Command Center.

TARGET: https://app.nabatable.com/settings/restaurant/[ROUTE]
SOURCE: analysis/restaurant-settings-consolidated/routes/[bundle].json (files[].content)

STACK: Next.js App Router, React, TypeScript, Shadcn/ui (components/ui/*), Lucide, motion/react, React Query, ops-session, ops-unsaved-changes.

DESIGN SYSTEM (mandatory):
- Semantic tokens only: bg-background, bg-card, text-foreground, text-muted-foreground, border-border, bg-muted, bg-primary, ring-ring, text-destructive. NO slate-*, NO blue-600.
- Reuse OpsPageShell, OpsPageHeader, OPS_* and SETTINGS_* classes from opsDensityClasses.ts / compactSettingsClasses.ts.
- Extend RestaurantSettingsPageShell, RestaurantSettingsSubnav, RestaurantSettingsCommandCenter, SettingsCard — do not replace global Ops sidebar.
- Cards: OPS_CARD_CLASS, rounded-lg|xl, border-border/70, shadow-none|sm.
- Inputs: Shadcn + focus-visible:ring-ring/50.
- Buttons: Shadcn variants (default/outline/ghost/destructive).
- Dirty: ops-unsaved-changes + floating bar (bg-foreground text-background) OR SETTINGS_COMPACT_STICKY_ACTION_ROW_CLASS.
- Motion: motion/react + useReducedMotion; layoutId for tab indicator.
- Preserve all hooks, mutations, validation, opsHref(), GBP/dual-sync behavior.

ROUTE: [overview | profile | google-business-profile | availability | menu | tables | team]

Deliver updated TSX modules (not one throwaway demo file). List files changed.

CODE TO REFACTOR:
[paste from routes/[bundle].json or src/]
```

---

## Nav copy (`routes.ts` — use in headers)

| Title                        | Description                                                                                     |
| ---------------------------- | ----------------------------------------------------------------------------------------------- |
| Restaurant setup             | Complete the essentials that make this restaurant ready for bookings.                           |
| Restaurant profile           | Public details, booking page URL, manager alerts, and optional discovery.                       |
| Google Business Profile      | Optional import and comparison support for public restaurant details.                           |
| Availability & Booking types | Booking rules, weekly hours, overrides, meal windows, booking types, and dining-duration bands. |
| Menu                         | Manage menus, sections, items, options, and Google-compatible publishing fields.                |
| Tables                       | Manage table inventory, zones, and capacity.                                                    |
| Team                         | Invite and manage restaurant staff access.                                                      |

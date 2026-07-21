# Luma 2.0 — design-system specification

> Status: **draft for review** · Author: design-system upgrade (Phase 3) · Supersedes the reverse-engineered snapshot in [`docs/design-system.md`](../design-system.md), which predates the Phase 1 token consolidation and is now stale.

Luma 2.0 is **not a re-skin**. Phases 1–2 already hardened the foundation, systematised typography, fixed the token layer, shipped dark mode, and gated drift in CI. 2.0 is the step that turns "a consistent system" into "a _codified_ system": one status vocabulary, one set of pattern primitives, one documented source of truth, and a small, deliberate set of aesthetic decisions that only the product owner can sign off.

This document is the **decision register** for that step. Each section states what exists today (grounded in source), the decision or open question, and — where the work is safe to do without an aesthetic call — the concrete plan.

---

## 1. Where Luma is today (post Phase 1–2)

| Dimension          | Current state                                                                                                                  | Source                                         |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- |
| **Neutrals**       | Zinc ramp (`--pg-ink` `#09090b` → `#fafafa`)                                                                                   | `styles/design-system/public-guest.tokens.css` |
| **Accent**         | Cobalt `--primary: 227 84% 49%` (`#1447E6`), `--pg-accent = --pg-cobalt`                                                       | same                                           |
| **Destructive**    | Red, the only non-cobalt status hue                                                                                            | same                                           |
| **Display type**   | Merriweather serif (guest) / Inter (ops), via `--pg-font-display` per-surface override                                         | same, `[data-theme='app']` block               |
| **Body / mono**    | Inter body, Geist Mono                                                                                                         | same                                           |
| **Radii**          | Restrained; `rounded-2xl` = 14px is the ceiling, zero `rounded-3xl`, `--pg-radius-pill` = 999px                                | `@theme` in `globals.css`                      |
| **Surfaces**       | Two: `data-theme='guest'` (warm, serif) and `data-theme='app'` (compact, sans)                                                 | `public-guest.tokens.css`                      |
| **Color mode**     | `.dark` orthogonal to `data-theme`; FOUC-free bootstrap; toggles on guest + ops + reserve                                      | `src/app/layout.tsx`, `useColorMode.ts`        |
| **Typography API** | `Heading` / `Text` primitives bound to `--pg-*` tokens (render on every surface); `subheading` variant for compact bold titles | `components/ui/typography.tsx`                 |
| **Drift gates**    | `guard:no-shadcn` (baseline ratchet), `guard:no-shadow-roots`, `guard:typography-scale`, `check-luma-compliance`               | `package.json`, `scripts/`                     |

**The calm-palette fact (SUPERSEDED by the §4.1 decision).** `OPS_STATUS_TONE_CLASSES` used to map `success`, `warning`, `info`, and `neutral` **all to cobalt**; only `danger` was red and `muted` gray. That calm two-hue treatment has been **replaced** — the product owner chose the full semantic palette (§4.1), so each state now carries its own hue (success = green, warning = amber, info = blue, danger = red; neutral keeps cobalt, muted stays gray). The hues resolve from the shared `--success`/`--warning`/`--info` tokens, which were already defined (light + dark, both surfaces) and wired into `@theme` — so this was a routing change, not new infrastructure.

---

## 2. The 2.0 thesis

Three sentences:

1. **One vocabulary per concept.** A status is a `(tone, label, icon?)` triple resolved through exactly one component and one tone set — never a per-feature reinvention.
2. **Primitives over instances.** Repeated shells (empty states, page headers, status pills) are DS primitives; feature code composes them and never re-implements them.
3. **The system documents itself.** The canonical spec (this file + a refreshed `design-system.md`) matches the code, and CI keeps them from diverging.

Everything below serves one of those three.

---

## 3. Decision register

### 3.1 Status badges — **DONE** ✅ (consolidated + semantic)

**Shipped.** `OpsStatusBadge` is now icon-capable and routes to the full semantic palette; the google-business `StatusBadge` was folded onto it (its verified/drift/error/pending vocabulary is now a domain mapper → success/warning/danger/info) and the dual-sync operation badge's icon now inherits its semantic tone. Booking statuses (§below) also moved to the semantic lifecycle palette. Every status hue is now driven by the shared semantic tokens, verified in-browser (light + dark). Remaining bespoke badge: `BookingStatusBadge` stays (it is the booking-domain component, already semantic via `lib/ops/booking-status.ts`).

**Was:** six implementations, three tone vocabularies:

| Implementation                        | Tone vocabulary                             | Spec                             |
| ------------------------------------- | ------------------------------------------- | -------------------------------- |
| `OpsStatusBadge` (canonical)          | `neutral/success/warning/danger/info/muted` | `rounded-md`, `text-xs`, no icon |
| `google-business-profile/StatusBadge` | `verified/drift/error/pending/muted`        | `rounded-full`, icon, `gap-1.5`  |
| `DualSyncOperationStatusBadge`        | dual-sync `variant` map                     | `font-mono`, `text-[10px]`, icon |
| `DualSyncQueueJobStatusBadge`         | dual-sync job map                           | icon                             |
| `DualSyncPublishJobStatusBadge`       | dual-sync job map                           | icon                             |
| `BookingStatusBadge`                  | booking states                              | booking-specific                 |

**Decision:** promote **one** primitive — `OpsStatusBadge` — to be **icon-capable** (optional `icon?: LucideIcon` + `showIcon`), keep the single `OpsStatusTone` vocabulary, and refactor the five others into **domain mappers** (`status → { tone, label, icon }`) that feed it. This is exactly the two-layer model `status-tones.ts` already documents ("Never map an arbitrary status string directly to styling"). The google-business `verified/drift/error/pending` vocabulary collapses cleanly onto `success/info/danger/pending→info`; dual-sync's already routes through domain constants.

- **No new colors** — reuses the existing calm palette, so it is not a rebrand and can land pre-merge.
- **Shape reconciliation is the one small aesthetic sub-call:** `rounded-md` (ops) vs `rounded-full` (settings). Recommend **`rounded-full` for status pills everywhere** (a pill reads as a status; a slightly-rounded rect reads as a tag). Flagged in §5.
- Net: 6 components → 1 primitive + 4 mappers; ~5 files simplified, every status looks like every other status.

### 3.2 Empty states — **DONE, verify only**

`OpsEmptyState` is already canonical (20+ importers). `BookingsListEmptyState` legitimately wraps it. Only action: the **old-root `components/dashboard/EmptyState.tsx`** (guest bookings dashboard) is a _different_ component in the legacy `components/` root — see §3.5.

### 3.3 Page shells — **KEEP SEPARATE, document the contract**

`GuestPageShell`, `OpsPageShell`, `RestaurantSettingsPageShell` are legitimately different surfaces (serif marketing vs compact ops vs settings sub-nav). A forced merge would over-abstract. **Decision:** no merge; instead document the shared _contract_ (title slot, actions slot, max-width, vertical rhythm) so the three stay parallel. `MetricCard` (marketing) vs `BookingStatCard` (ops) — same call, keep separate.

### 3.4 Reserve typography — **needs a shared package (deferred, tracked)**

`reserve/` is a separate Vite bundle with no path alias to `@/components/ui/typography` and no local primitive. Options: (a) publish the typography primitive as a tiny internal package both bundles import, or (b) duplicate a reserve-local `Heading`/`Text` bound to the same `--pg-*` tokens. Recommend (a). Non-trivial; **not** in the 2.0 safe-set.

### 3.5 Legacy root migration — **separate, deliberate task**

`components/dashboard/` still holds a live 8-file cluster (`BookingsTable`, `EditBookingDialog`, `EmptyState`, …) in the pre-Phase-1 root. Moving it to `src/components/` is real work (8 files + every importer) and is orthogonal to Luma 2.0 aesthetics. Tracked as its own task; **not** blended into a rebrand PR.

### 3.6 Documentation — **REFRESH (safe)**

`docs/design-system.md` and `docs/DESIGN_TOKENS.md` cite deleted files (`styles/base.css`, `styles/themes/*.css`, `tailwind.config.js`). Refresh them to the consolidated reality (`globals.css` `@theme inline` + `styles/design-system/*`), and link this spec as the forward-looking source. Safe to do now.

---

## 4. Aesthetic decisions

Each of these changes the brand's felt identity, so they belong to the product owner. **All five are now decided and shipped** (2026-07-21).

1. **Palette — DECIDED: full semantic palette.** ✅ Distinct hues per state (success = green, warning = amber, info = blue, danger = red; neutral = cobalt, muted = gray), for maximum state clarity. Applied across the status system and the booking lifecycle (§3.1). The calm two-hue and restrained-semantic alternatives were not taken.
2. **Serif reach — DECIDED: keep ops all-sans.** ✅ Merriweather stays a guest/marketing display signature; ops headings remain Inter for density. No code change required — this ratifies today's behaviour.
3. **Density tokens — DECIDED + shipped.** ✅ A surface-scoped `--pg-density-*` scale (gap, gap-tight, card-px/py, control-h): comfortable by default, compact under `[data-theme='app']`. Consumed by `OPS_PAGE_CONTENT_STACK_CLASS` and the ops card padding consts (`OPS_CARD_HEADER/CONTENT/FOOTER_CLASS` → `--pg-density-card-px/py` + `gap-tight`; the prior `sm:px-5` bump now lives in the token via a `min-width:640px` override), all verified non-regressing in-browser (ops 16→20px px / 12px py; guest 24px / 20px).
4. **Motion language — DECIDED + shipped.** ✅ Semantic `--pg-transition-hover/panel/emphasis` shorthands composed from the durations + `--pg-ease-out/spring/snap`; used via arbitrary values (`ease-[var(--pg-ease-spring)]`, `transition-[var(--pg-transition-panel)]`). Reduced-motion is neutralised globally. Kept as tokens (one source for the whole app); `--guest-transition-*` already consumes them.
5. **Radius identity — DECIDED: keep restrained.** ✅ The `--radius-*` scale (ceiling 1.25rem/20px, components ≤ `rounded-2xl`/14px in practice) is ratified as the identity — no warmer-guest divergence. Documented in `globals.css` `@theme`.

All five §4 forks are now resolved; the remaining out-of-pass items are the reserve typography package (§3.4) and the legacy-root migration (§3.5).

---

## 5. What lands without waiting for anything

Safe-set — verifiable by local typecheck/test/guard even while CI billing is blocked. **All shipped:**

- [x] **Semantic palette + status consolidation** (§3.1, §4.1): icon-capable `OpsStatusBadge` routed to semantic tones; google-business badge folded onto it; dual-sync operation icon inherits its tone; booking lifecycle recoloured. Verified in-browser (light + dark).
- [x] **Doc refresh** (§3.6): `design-system.md` / `DESIGN_TOKENS.md` bannered and pointed at the real sources + this spec.
- [x] **`subheading` coverage**: 16 mini-titles migrated.
- [x] **Serif reach ratified** (§4.2): ops stays all-sans; no change needed.

Remaining open aesthetic forks (§4.3–4.5: density, motion, radius) and the reserve/legacy-root items (§3.4, §3.5) are **out** of this pass and tracked for later.

---

## 6. Rollout sequence

1. **DONE — status consolidation + doc refresh** (§3.1, §3.6). Verified locally, on the branch.
2. **DONE — §4 decisions + implementation**: full semantic palette, ops-all-sans, density scale, motion language, restrained radius. Token-level, so most of the app inherits them through `--pg-*` / `@theme`.
3. **GATE (pending, user-owned):** merge PR #106 + fix GitHub Actions billing → the ~25 stacked commits get CI-validated; re-sync the DS catalog.
4. **Broaden token adoption — DONE.** The ops card-padding consts now consume `--pg-density-card-px/py` (the `sm:` bump baked into the token). Motion: the component layer was surveyed and has no clean migration — the two hard-coded animations (a keyframe shake, a Web-Animations-API easing) and the ~15 `transition-[props] duration-* ease-*` call sites use idiomatic Tailwind timings (150/200/700ms) that don't map onto the 150/250/500ms `--pg-transition-*` shorthands, so forcing them would be retiming, not adoption. The shorthands stay the source for guest CSS (`--guest-transition-*`) and new code.
5. **Reserve + legacy root (§3.4, §3.5):** shared typography package, then the `components/dashboard/` migration.
6. **Re-sync DS + refresh baselines:** update the guard baselines to the 2.0 numbers; dual-mode (light/dark) e2e snapshots.

---

## 7. Guardrails (unchanged, extended)

The existing ratchets stay. 2.0 adds: a **status-badge guard** (no new bespoke `Badge` with a hand-rolled tone map outside `status-tones.ts` — enforces §3.1 staying consolidated), and, once §4 lands, a refreshed `check-luma-compliance` allow-list for any new semantic hues.

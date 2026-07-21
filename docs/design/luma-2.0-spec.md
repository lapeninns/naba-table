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

**The calm-palette fact.** `OPS_STATUS_TONE_CLASSES` maps `success`, `warning`, `info`, and `neutral` **all to cobalt** (`bg-primary/10 text-primary`); only `danger` is red and `muted` is gray (`lib/ops/status-tones.ts:46`). This is deliberate — a calm, two-hue ops surface, not a rainbow of state colors. Any 2.0 change here is an aesthetic decision, **not** a bug fix.

---

## 2. The 2.0 thesis

Three sentences:

1. **One vocabulary per concept.** A status is a `(tone, label, icon?)` triple resolved through exactly one component and one tone set — never a per-feature reinvention.
2. **Primitives over instances.** Repeated shells (empty states, page headers, status pills) are DS primitives; feature code composes them and never re-implements them.
3. **The system documents itself.** The canonical spec (this file + a refreshed `design-system.md`) matches the code, and CI keeps them from diverging.

Everything below serves one of those three.

---

## 3. Decision register

### 3.1 Status badges — **CONSOLIDATE** (safe, no aesthetic call required)

**Today:** six implementations, three tone vocabularies:

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

## 4. Aesthetic decisions that need the product owner

These are the **only** parts of 2.0 that I will not decide unilaterally — each changes the brand's felt identity:

1. **Calm vs semantic palette.** Keep the two-hue cobalt+red ops surface, or introduce _restrained_ success-green / warning-amber (still muted, Zinc-adjacent)? This is the single biggest 2.0 fork.
2. **Serif reach.** Merriweather is guest-display only today. Does 2.0 pull the serif into ops headings for brand cohesion, or keep ops all-sans for density?
3. **Density tokens.** Ops is "compact" by convention, not by token. Introduce a `--density` scale (comfortable/compact) as a first-class control?
4. **Motion language.** `motion` is a dependency but there's no systematised enter/exit/hover vocabulary. Define one (durations, easings, reduced-motion) as part of 2.0?
5. **Radius identity.** Keep the restrained 14px ceiling, or soften toward a warmer 16–20px on guest surfaces only?

§6 sequences the work around these.

---

## 5. What lands without waiting for anything

Safe-set — no aesthetic call, reuses existing tokens, verifiable by local typecheck/test/guard even while CI billing is blocked:

- [ ] **Status-badge consolidation** (§3.1): icon-capable `OpsStatusBadge` + 4 domain mappers; delete the 3 dual-sync + 1 google-business bespoke badges.
- [ ] **Doc refresh** (§3.6): update `design-system.md` / `DESIGN_TOKENS.md`, link this spec.
- [ ] **`subheading` coverage** (done): 16 mini-titles migrated.
- [ ] Pill-shape reconciliation decision (the one sub-call in §3.1) — recommend `rounded-full`.

Open aesthetic forks (§4) and the reserve/legacy-root items (§3.4, §3.5) are explicitly **out** of the safe-set.

---

## 6. Rollout sequence

1. **Now (pre-merge, safe-set):** §3.1 status consolidation + §3.6 doc refresh. Verified locally, stacked on the Phase 2 branch.
2. **Gate:** merge PR #106 + fix GitHub Actions billing → the ~20 stacked commits get CI-validated; re-sync the DS catalog.
3. **Decide:** product owner answers §4 (the five forks). One short working session.
4. **Implement 2.0 aesthetics (§4 outcomes):** token-level changes flow through `--pg-*` / `@theme`, so most of the app inherits them for free; audit the arbitrary-value holdouts.
5. **Reserve + legacy root (§3.4, §3.5):** shared typography package, then the `components/dashboard/` migration.
6. **Re-sync DS + refresh baselines:** update the guard baselines to the 2.0 numbers; dual-mode (light/dark) e2e snapshots.

---

## 7. Guardrails (unchanged, extended)

The existing ratchets stay. 2.0 adds: a **status-badge guard** (no new bespoke `Badge` with a hand-rolled tone map outside `status-tones.ts` — enforces §3.1 staying consolidated), and, once §4 lands, a refreshed `check-luma-compliance` allow-list for any new semantic hues.

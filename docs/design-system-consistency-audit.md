# Design System Consistency Audit — Guest vs Ops

> Audited from the SajiloReserveX repository. All claims cite source files.

---

## Verdict

**Not consistent.** The guest-facing and ops-facing surfaces share a common token foundation (`src/app/globals.css`) and component library (shadcn/ui), but in practice they diverge significantly. Semantic tokens were defined but not adopted — both surfaces bypass the token layer and style directly with Tailwind utility classes, creating two parallel visual languages that share infrastructure but not design intent.

---

## Inconsistencies (by severity)

### 1. Dark Mode Is Broken on Guest (Critical)

Guest primitives hardcode light-only colors — `bg-white`, `text-slate-900`, `border-slate-200`, `bg-blue-600` — throughout `src/components/guest/ui/GuestPrimitives.tsx`. Despite `styles/themes/guest.css` defining dark-mode token overrides (`[data-theme='guest'].dark`), the guest components **don't consume those tokens**, so enabling `.dark` on guest pages would produce low-contrast, unreadable UI.

Ops components, by contrast, include `dark:` variants (e.g., `components/ui/badge.tsx:18-24` uses `dark:bg-green-900 dark:text-green-100`).

**Evidence:**

| File                                                  | Hardcoded light-only values                             |
| ----------------------------------------------------- | ------------------------------------------------------- |
| `src/components/guest/ui/GuestPrimitives.tsx:93`      | `border-slate-200 bg-white`                             |
| `src/components/guest/ui/GuestPrimitives.tsx:109`     | `text-slate-900`                                        |
| `src/components/guest/ui/GuestPrimitives.tsx:133`     | `border-slate-200 bg-white`                             |
| `src/components/guest/ui/GuestPrimitives.tsx:280`     | `bg-blue-600 hover:bg-blue-700 text-white`              |
| `src/components/guest/ui/GuestPrimitives.tsx:308-311` | `bg-blue-50`, `bg-green-50`, `bg-amber-50`, `bg-red-50` |

**Dark-mode tokens that exist but are unused:**

| Token                  | Dark value         | Source                                 |
| ---------------------- | ------------------ | -------------------------------------- |
| `--primary`            | `217 91% 70%`      | `styles/themes/guest.css:86`           |
| `--accent`             | `0 100% 75%`       | `styles/themes/guest.css:90`           |
| `--color-surface-warm` | `hsl(217 19% 12%)` | `styles/themes/guest-enhanced.css:270` |
| `--text-heading`       | `hsl(217 19% 90%)` | `styles/themes/guest-enhanced.css:275` |

---

### 2. Status Color Palettes Diverge (High)

Three separate, incompatible status color systems coexist:

| Meaning             | Guest (`GuestPrimitives.tsx:308-311`) | Ops StatusChip (`StatusChip.tsx:17-55`) | Badge variants (`badge.tsx:18-24`) |
| ------------------- | ------------------------------------- | --------------------------------------- | ---------------------------------- |
| Success / Confirmed | `bg-green-50 text-green-700`          | `bg-emerald-50 text-emerald-800`        | `bg-green-100 text-green-800`      |
| Warning / Pending   | `bg-amber-50 text-amber-700`          | `bg-amber-50 text-amber-800`            | `bg-amber-100 text-amber-800`      |
| Error / Cancelled   | `bg-red-50 text-red-700`              | `bg-rose-50 text-rose-700`              | `bg-red-100 text-red-800`          |
| Info                | `bg-blue-50 text-blue-700`            | `bg-sky-50 text-sky-700`                | —                                  |

None of these consume the semantic `--success`, `--warning`, `--destructive`, `--info` HSL tokens defined in `:root`. The tokens exist but are effectively dead code for status UIs.

**Additional ops-only status palettes found:**

| Status             | Color                          | Source                                                                                                        |
| ------------------ | ------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Priority Waitlist  | `bg-purple-50 text-purple-800` | `components/dashboard/StatusChip.tsx:59`                                                                      |
| Pending Allocation | `bg-sky-50 text-sky-700`       | `components/dashboard/StatusChip.tsx:35`                                                                      |
| Suggested Tables   | `bg-indigo-50 text-indigo-800` | `src/components/features/dashboard/booking-details/components/table-assignment/SuggestedTablesSection.tsx:57` |
| Check-out action   | `bg-orange-600`                | `src/components/features/dashboard/booking-details/BookingDialog.tsx:365`                                     |

---

### 3. Component Bifurcation (High)

Guest and ops use **different card/section components** that guarantee visual divergence:

| Aspect        | Guest (`GuestCard` / `GuestSection`)              | Ops (`Card` from `components/ui/card.tsx`)      |
| ------------- | ------------------------------------------------- | ----------------------------------------------- |
| Border radius | `rounded-3xl` (24px)                              | `rounded-xl` (16px)                             |
| Border        | `border-slate-200` (hardcoded)                    | `border` (token-based via `hsl(var(--border))`) |
| Background    | `bg-white` (hardcoded)                            | `bg-card` (token-based)                         |
| Shadow        | `shadow-[0_1px_2px_rgba(0,0,0,0.05)]` (hardcoded) | `shadow` (token `--shadow`)                     |
| Padding       | `p-6` / `p-8` inline                              | `p-6` in sub-components                         |
| Dark mode     | Broken (hardcoded white)                          | Works (uses `--card` token)                     |

**Source files:**

- Guest: `src/components/guest/ui/GuestPrimitives.tsx:93-143`
- Ops: `components/ui/card.tsx:6-17`

---

### 4. Button Shape Diverges (Medium)

Guest overrides every Button to `rounded-full px-8`. Ops uses the default `rounded-md`. The Button component has no built-in "guest" variant — this is always done via className override, making it fragile.

| Surface | Button shape           | Evidence                                                  |
| ------- | ---------------------- | --------------------------------------------------------- |
| Guest   | `rounded-full px-8`    | `src/components/guest/ui/GuestPrimitives.tsx:379,419,424` |
| Ops     | `rounded-md` (default) | `components/ui/button.tsx:8` (base class)                 |

---

### 5. Dual Theme Mechanism (Medium)

Guest theming is applied through **two competing CSS mechanisms**:

1. `[data-theme='guest']` selectors in `styles/themes/guest.css`
2. `.guest-theme` class overrides in `src/app/globals.css:216-361`

Both define the same tokens (e.g., `--primary: 217 91% 60%`) but via different selectors. Which wins depends on DOM structure and CSS cascade order — a specificity bug waiting to happen.

**Example of duplication:**

| Token         | `[data-theme='guest']` source | `.guest-theme` source     |
| ------------- | ----------------------------- | ------------------------- |
| `--primary`   | `styles/themes/guest.css:21`  | `src/app/globals.css:227` |
| `--accent`    | `styles/themes/guest.css:33`  | `src/app/globals.css:242` |
| `--secondary` | `styles/themes/guest.css:40`  | `src/app/globals.css:239` |
| `--muted`     | `styles/themes/guest.css:43`  | `src/app/globals.css:246` |

---

### 6. Ops Token Definitions Exist But Aren't Consumed (Medium)

The app theme (`styles/themes/app.css`) defines compact spacing tokens, but the Card component and other ops UI hardcode their own values:

| Token defined     | Value      | Component actual         | Source                                                    |
| ----------------- | ---------- | ------------------------ | --------------------------------------------------------- |
| `--card-padding`  | `1rem`     | `p-6` (1.5rem) hardcoded | `styles/themes/app.css:13` vs `components/ui/card.tsx:32` |
| `--screen-margin` | `0.75rem`  | Not consumed anywhere    | `styles/themes/app.css:14`                                |
| `--app-text-body` | `0.875rem` | `text-sm` used ad-hoc    | `styles/themes/app.css:19`                                |

---

### 7. Hardcoded Colors Pervasive on Both Surfaces (Medium)

Ops dashboard has **60+ instances** of hardcoded Tailwind color classes scattered across booking details, table floor plan, status chips, and action buttons. Guest has a similar volume. Neither surface would survive a brand palette change without touching dozens of files.

**Ops hotspots (hardcoded colors):**

| File                                                                                   | Colors used                                |
| -------------------------------------------------------------------------------------- | ------------------------------------------ |
| `src/components/features/dashboard/booking-details/BookingDialog.tsx`                  | emerald, blue, rose, indigo, orange, slate |
| `src/components/features/dashboard/cards/OpsBookingCardActions.tsx`                    | emerald-600, rose-600, slate-700           |
| `src/components/features/dashboard/HeatmapCalendar.tsx`                                | emerald-100 through emerald-600            |
| `src/components/features/dashboard/ConnectionStatusBeacon.tsx`                         | emerald-500, amber-500, rose-500           |
| `src/components/features/dashboard/booking-details/components/SelectableTableCard.tsx` | emerald, blue, amber, rose, slate          |

**Guest hotspots (hardcoded colors):**

| File                                          | Colors used                                                      |
| --------------------------------------------- | ---------------------------------------------------------------- |
| `src/components/guest/ui/GuestPrimitives.tsx` | slate-200/400/500/900, blue-50/600/700, green-50, red-50/100/600 |

---

### 8. Shadow System Fragmentation (Low)

Three shadow systems coexist:

| System         | Tokens                                                                  | Used by                         | Source                                   |
| -------------- | ----------------------------------------------------------------------- | ------------------------------- | ---------------------------------------- |
| Base           | `--shadow-sm` through `--shadow-xl`                                     | Ops (via Tailwind classes)      | `styles/base.css:126-131`                |
| Guest          | `--guest-shadow-xs` through `--guest-shadow-xl` + `--guest-shadow-glow` | Guest CSS utilities (partially) | `src/app/globals.css:338-349`            |
| Guest Enhanced | `--shadow-card`, `--shadow-card-hover`, `--shadow-featured`             | Guest enhanced theme            | `styles/themes/guest-enhanced.css:31-41` |

`GuestPrimitives.tsx` ignores all three and uses inline Tailwind arbitrary shadows: `shadow-[0_1px_2px_rgba(0,0,0,0.05)]`, `shadow-[0_6px_16px_rgba(0,0,0,0.08)]`.

---

## What IS Consistent

| Aspect                | Details                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Shared primitives** | Both surfaces import the same Button, Badge, and Form from `components/ui/`                                   |
| **Class composition** | Both use `cn()` (clsx + tailwind-merge) from `lib/utils.ts`                                                   |
| **Reduced motion**    | `prefers-reduced-motion: reduce` respected globally on both surfaces                                          |
| **Touch targets**     | 44px minimum enforced via global CSS on both surfaces                                                         |
| **Icon library**      | Both use Lucide React exclusively                                                                             |
| **Form validation**   | Both use react-hook-form + zod                                                                                |
| **Typography intent** | Divergence (fluid guest vs fixed ops) is intentional — guest needs responsive scaling, ops needs data density |

---

## Root Cause

The fundamental issue is that **semantic tokens were defined but not adopted**. Both surfaces bypass the token layer and style directly with Tailwind utility classes, creating two parallel visual languages that share infrastructure but not design intent. A palette change, dark mode toggle, or brand refresh would require touching 50+ files on each surface.

---

## Recommended Actions

### Immediate (fixes breakage)

1. **Wire guest components to tokens**: Replace `bg-white` → `bg-card`, `text-slate-900` → `text-foreground`, `border-slate-200` → `border` in `GuestPrimitives.tsx` to unblock dark mode.
2. **Eliminate dual theme mechanism**: Consolidate `.guest-theme` class overrides into `[data-theme='guest']` selectors. Remove the duplicated block in `globals.css:216-361`.

### Short-term (reduces drift)

3. **Unify status color system**: Define a single semantic status layer backed by CSS variables (`--success`, `--warning`, `--destructive`, `--info`). Make `GuestStatus`, `StatusChip`, and Badge status variants consume it.
4. **Add a Button "guest" size variant**: Add `guest: 'rounded-full px-8'` as a proper CVA size variant instead of relying on className overrides.
5. **Wire app theme tokens to Card**: Make `CardHeader`/`CardContent` consume `--card-padding` instead of hardcoding `p-6`.

### Long-term (systemic)

6. **Audit and replace hardcoded colors**: Sweep both surfaces for raw Tailwind color classes and migrate to semantic tokens. Estimated scope: ~60 files on ops, ~15 on guest.
7. **Converge on a single Card primitive**: Either extend `components/ui/card.tsx` with a `guest` variant (rounded-3xl, warm shadows) or make `GuestCard` consume the Card primitive internally.
8. **Define a z-index and shadow scale**: Formalize these as part of the token system.

---

_Audited: 2026-02-06_

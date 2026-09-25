# Design System — Nab a Table (archived snapshot)

> [!CAUTION]
> **Archived.** This file was moved from `docs/design-system.md` and is kept for history only.
> The current design system is [`DESIGN.md`](../../../DESIGN.md).

> Reverse-engineered from the [SajiloReserveX](https://github.com/lapeninns/nabatable) repository.
> All claims cite source files. "Unknown" is used where evidence is absent.

> [!WARNING]
> **This is a pre-consolidation snapshot and is partially stale.** It predates the Phase 1 token
> consolidation. Several files cited below (`styles/base.css`, `styles/tokens.css`,
> `styles/themes/guest.css`, `styles/themes/app.css`, `styles/guest-design-system.css`,
> `tailwind.config.js`) have been **removed or merged**. The token layer now lives in:
>
> - **`src/app/globals.css`** — the `@theme inline` layer (Tailwind v4) + semantic `.dark` tokens
> - **`styles/design-system/public-guest.tokens.css`** — the `--pg-*` palette/type/shape tokens and per-surface (`[data-theme='guest'|'app']`) + `.dark` overrides
> - **`styles/design-system/public-guest.utilities.css`** — the `.pg-*` utility bridge
>
> For the current state and the forward plan, read **[`luma-2.0-spec.md`](../luma-2.0-spec.md)**.
> The colour/type/shape _values_ below are mostly still accurate; the _file map_ is not.

---

## Overview

| Attribute          | Value                                                                                  | Source                                                      |
| ------------------ | -------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| **Framework**      | Next.js 16 (App Router, React 19) + Vite (Reserve app)                                 | `package.json`                                              |
| **CSS Strategy**   | Tailwind CSS v4 + CSS custom properties (HSL tokens)                                   | `tailwind.config.js`, `postcss.config.js`                   |
| **UI Library**     | shadcn/ui (new-york style) on Radix UI primitives                                      | `components.json`                                           |
| **Variant System** | `class-variance-authority` (CVA) + `clsx` + `tailwind-merge`                           | `package.json`, `lib/utils.ts`                              |
| **Icons**          | Lucide React                                                                           | `components.json` (`iconLibrary: "lucide"`), `package.json` |
| **Motion**         | `motion` (Framer successor) + CSS keyframes + `tw-animate-css` + `tailwindcss-animate` | `package.json`                                              |
| **Forms**          | react-hook-form + zod + @hookform/resolvers                                            | `package.json`                                              |
| **Toasts**         | sonner                                                                                 | `components/ui/sonner.tsx`                                  |
| **Storybook**      | Storybook 10 (Reserve app only)                                                        | `reserve/.storybook/`, `package.json`                       |
| **Dark Mode**      | `.dark` class on `<html>`                                                              | `tailwind.config.js:11`                                     |
| **Theming**        | `data-theme` attribute (`app` \| `guest`)                                              | `styles/themes/app.css`, `styles/themes/guest.css`          |

### Architecture

The design system serves **two surfaces**:

1. **App theme** (`data-theme="app"`) — compact, data-dense dashboard for restaurant operators
2. **Guest theme** (`data-theme="guest"` / `.guest-theme`) — warm, trust-focused palette for diners

### Key Design-System Files

| File                               | Role                                                                 |
| ---------------------------------- | -------------------------------------------------------------------- |
| `src/app/globals.css`              | Master entry — imports all layers, defines `:root` + `.dark` tokens  |
| `styles/base.css`                  | Base resets, `:root` + `.dark` color/shape/shadow tokens, a11y rules |
| `styles/tokens.css`                | SR-prefixed token aliases, spacing scale, utility classes            |
| `styles/animations.css`            | Keyframe definitions + animation utility classes                     |
| `styles/themes/guest.css`          | Guest palette overrides (blue primary, coral accent)                 |
| `styles/themes/guest-enhanced.css` | Guest warm surfaces, layered shadows, motion, typography             |
| `styles/themes/app.css`            | App theme compact spacing and text scale                             |
| `styles/guest-design-system.css`   | Guest class-based typography and utility bridge                      |
| `tailwind.config.js`               | Tailwind extensions — colors, typography, spacing, animations        |
| `components.json`                  | shadcn/ui configuration                                              |
| `lib/utils.ts`                     | `cn()` helper (clsx + tailwind-merge)                                |

---

## Foundations

### Colors

#### Semantic Palette — Light (`:root`)

| Token                    | HSL Value       | Usage                     | Source                    |
| ------------------------ | --------------- | ------------------------- | ------------------------- |
| `--background`           | `0 0% 100%`     | Page background (white)   | `src/app/globals.css:49`  |
| `--foreground`           | `222 47% 11%`   | Primary text              | `src/app/globals.css:50`  |
| `--card`                 | `0 0% 100%`     | Card surface              | `src/app/globals.css:51`  |
| `--card-foreground`      | `222 47% 11%`   | Card text                 | `src/app/globals.css:52`  |
| `--popover`              | `0 0% 100%`     | Popover surface           | `src/app/globals.css:53`  |
| `--popover-foreground`   | `222 47% 11%`   | Popover text              | `src/app/globals.css:54`  |
| `--primary`              | `222 47% 11%`   | Brand primary (dark navy) | `src/app/globals.css:57`  |
| `--primary-foreground`   | `210 40% 98%`   | Text on primary           | `src/app/globals.css:58`  |
| `--secondary`            | `210 40% 96.1%` | Secondary surface         | `src/app/globals.css:59`  |
| `--secondary-foreground` | `222 47% 11%`   | Text on secondary         | `src/app/globals.css:60`  |
| `--muted`                | `210 40% 96.1%` | Muted surface             | `src/app/globals.css:63`  |
| `--muted-foreground`     | `215 16% 45%`   | Muted text                | `src/app/globals.css:64`  |
| `--accent`               | `210 40% 96.1%` | Accent surface            | `src/app/globals.css:65`  |
| `--accent-foreground`    | `222 47% 11%`   | Text on accent            | `src/app/globals.css:66`  |
| `--destructive`          | `0 84.2% 60.2%` | Error/danger              | `src/app/globals.css:81`  |
| `--success`              | `142 76% 36%`   | Success                   | `src/app/globals.css:83`  |
| `--warning`              | `38 92% 50%`    | Warning                   | `src/app/globals.css:85`  |
| `--info`                 | `199 89% 48%`   | Informational             | `src/app/globals.css:87`  |
| `--border`               | `214 32% 91%`   | Default border            | `src/app/globals.css:112` |
| `--input`                | `214 32% 91%`   | Input border              | `src/app/globals.css:113` |
| `--ring`                 | `222 47% 11%`   | Focus ring                | `src/app/globals.css:114` |

#### Semantic Palette — Dark (`.dark`)

| Token                  | HSL Value     | Source                    |
| ---------------------- | ------------- | ------------------------- |
| `--background`         | `222 47% 11%` | `src/app/globals.css:149` |
| `--foreground`         | `210 40% 98%` | `src/app/globals.css:150` |
| `--card`               | `222 40% 13%` | `src/app/globals.css:154` |
| `--primary`            | `210 40% 98%` | `src/app/globals.css:159` |
| `--primary-foreground` | `222 47% 11%` | `src/app/globals.css:160` |
| `--secondary`          | `217 33% 17%` | `src/app/globals.css:161` |
| `--muted`              | `217 33% 17%` | `src/app/globals.css:164` |
| `--muted-foreground`   | `215 20% 65%` | `src/app/globals.css:165` |
| `--destructive`        | `0 72% 51%`   | `src/app/globals.css:169` |
| `--border`             | `217 33% 17%` | `src/app/globals.css:178` |
| `--ring`               | `212 35% 70%` | `src/app/globals.css:180` |

#### Guest Theme (`[data-theme='guest']`)

| Token         | HSL Value      | Usage                   | Source                       |
| ------------- | -------------- | ----------------------- | ---------------------------- |
| `--primary`   | `217 91% 60%`  | Blue-500 (trust)        | `styles/themes/guest.css:21` |
| `--accent`    | `0 100% 71%`   | Coral-500 (warmth/CTAs) | `styles/themes/guest.css:33` |
| `--secondary` | `213 96% 93%`  | Light blue surface      | `styles/themes/guest.css:40` |
| `--muted`     | `213 100% 96%` | Very light blue         | `styles/themes/guest.css:43` |
| `--border`    | `216 33% 90%`  | Subtle border           | `styles/themes/guest.css:56` |
| `--ring`      | `217 91% 60%`  | Blue focus ring         | `styles/themes/guest.css:57` |

#### Guest Enhanced Surfaces

| Token                      | Value                 | Source                                |
| -------------------------- | --------------------- | ------------------------------------- |
| `--color-surface-warm`     | `#fefdfb` (cream)     | `styles/themes/guest-enhanced.css:13` |
| `--color-surface-elevated` | `#ffffff`             | `styles/themes/guest-enhanced.css:15` |
| `--color-surface-muted`    | `#f8f7f5` (off-white) | `styles/themes/guest-enhanced.css:17` |
| `--text-body-warm`         | `hsl(217 19% 35%)`    | `styles/themes/guest-enhanced.css:57` |
| `--text-heading`           | `hsl(217 19% 20%)`    | `styles/themes/guest-enhanced.css:59` |

#### Neutral Scale (Slate)

| Token                 | Hex       | Source               |
| --------------------- | --------- | -------------------- |
| `--color-neutral-0`   | `#ffffff` | `styles/base.css:24` |
| `--color-neutral-50`  | `#f8fafc` | `styles/base.css:25` |
| `--color-neutral-100` | `#f1f5f9` | `styles/base.css:26` |
| `--color-neutral-200` | `#e2e8f0` | `styles/base.css:27` |
| `--color-neutral-300` | `#cbd5e1` | `styles/base.css:28` |
| `--color-neutral-400` | `#94a3b8` | `styles/base.css:29` |
| `--color-neutral-500` | `#64748b` | `styles/base.css:30` |
| `--color-neutral-600` | `#475569` | `styles/base.css:31` |
| `--color-neutral-700` | `#334155` | `styles/base.css:32` |
| `--color-neutral-800` | `#1e293b` | `styles/base.css:33` |
| `--color-neutral-900` | `#0f172a` | `styles/base.css:34` |

#### Chart Colors

| Token       | Light         | Dark          | Source                        |
| ----------- | ------------- | ------------- | ----------------------------- |
| `--chart-1` | `12 76% 61%`  | `220 70% 50%` | `src/app/globals.css:117,201` |
| `--chart-2` | `173 58% 39%` | `160 60% 45%` | `src/app/globals.css:118,202` |
| `--chart-3` | `197 37% 24%` | `30 80% 55%`  | `src/app/globals.css:119,203` |
| `--chart-4` | `43 74% 66%`  | `280 65% 60%` | `src/app/globals.css:120,204` |
| `--chart-5` | `27 87% 67%`  | `340 75% 55%` | `src/app/globals.css:121,205` |

---

### Typography

#### Font Family

| Token           | Value                                                                                | Source                                            |
| --------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------- |
| `--font-sajilo` | `'Nab a Table Cereal App', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif` | `styles/base.css:18-19`, `tailwind.config.js:133` |

Font features: `'cv02', 'cv03', 'cv04', 'cv11'`, `font-variant-numeric: tabular-nums` — `src/app/globals.css:415-416`

#### App Type Scale (Fixed)

| Class                 | Size | Line Height | Weight | Source                   |
| --------------------- | ---- | ----------- | ------ | ------------------------ |
| `text-screen-title`   | 34px | 40px        | 700    | `tailwind.config.js:138` |
| `text-section-header` | 22px | 28px        | 600    | `tailwind.config.js:139` |
| `text-card-title`     | 18px | 22px        | 600    | `tailwind.config.js:140` |
| `text-body`           | 16px | 24px        | 400    | `tailwind.config.js:141` |
| `text-label`          | 14px | 20px        | 400    | `tailwind.config.js:142` |
| `text-button`         | 16px | 20px        | 600    | `tailwind.config.js:143` |

#### Guest Type Scale (Fluid)

| Token / Class          | Value                                  | Range   | Source                    |
| ---------------------- | -------------------------------------- | ------- | ------------------------- |
| `--guest-text-hero`    | `clamp(2rem, 5vw + 1rem, 3rem)`        | 32–48px | `src/app/globals.css:301` |
| `--guest-text-hero-lg` | `clamp(2.5rem, 6vw + 1rem, 4rem)`      | 40–64px | `src/app/globals.css:303` |
| `--guest-text-page`    | `clamp(1.5rem, 3vw + 1rem, 2rem)`      | 24–32px | `src/app/globals.css:304` |
| `--guest-text-section` | `clamp(1.25rem, 2vw + 0.5rem, 1.5rem)` | 20–24px | `src/app/globals.css:306` |
| `--guest-text-card`    | `1.125rem`                             | 18px    | `src/app/globals.css:308` |
| `--guest-text-body`    | `1rem`                                 | 16px    | `src/app/globals.css:310` |
| `--guest-text-caption` | `0.875rem`                             | 14px    | `src/app/globals.css:312` |
| `--guest-text-micro`   | `0.75rem`                              | 12px    | `src/app/globals.css:314` |

#### Line Heights

| Token                     | Value  | Usage          | Source                    |
| ------------------------- | ------ | -------------- | ------------------------- |
| `--guest-leading-tight`   | `1.1`  | Headlines      | `src/app/globals.css:318` |
| `--guest-leading-snug`    | `1.35` | Sub-headings   | `src/app/globals.css:320` |
| `--guest-leading-normal`  | `1.5`  | Body text      | `src/app/globals.css:321` |
| `--guest-leading-relaxed` | `1.75` | Long-form text | `src/app/globals.css:323` |

#### Font Weights

| Token                       | Value | Source                 |
| --------------------------- | ----- | ---------------------- |
| `--sr-font-weight-regular`  | 400   | `styles/tokens.css:33` |
| `--sr-font-weight-medium`   | 500   | `styles/tokens.css:34` |
| `--sr-font-weight-semibold` | 600   | `styles/tokens.css:35` |
| `--sr-font-weight-bold`     | 700   | `styles/tokens.css:36` |

#### Heading Defaults

All headings (`h1`–`h6`): `font-weight: 600`, `letter-spacing: -0.02em`, `scroll-margin-top: 5rem` — `src/app/globals.css:430-439`

---

### Spacing & Layout

#### SR Spacing Scale (4/8pt grid)

| Token           | rem  | px  | Source                 |
| --------------- | ---- | --- | ---------------------- |
| `--sr-space-0`  | 0    | 0   | `styles/tokens.css:41` |
| `--sr-space-1`  | 0.25 | 4   | `styles/tokens.css:42` |
| `--sr-space-2`  | 0.5  | 8   | `styles/tokens.css:43` |
| `--sr-space-3`  | 0.75 | 12  | `styles/tokens.css:44` |
| `--sr-space-4`  | 1    | 16  | `styles/tokens.css:45` |
| `--sr-space-5`  | 1.5  | 24  | `styles/tokens.css:46` |
| `--sr-space-6`  | 2    | 32  | `styles/tokens.css:47` |
| `--sr-space-7`  | 2.5  | 40  | `styles/tokens.css:48` |
| `--sr-space-8`  | 3    | 48  | `styles/tokens.css:49` |
| `--sr-space-9`  | 4    | 64  | `styles/tokens.css:50` |
| `--sr-space-10` | 5    | 80  | `styles/tokens.css:51` |
| `--sr-space-11` | 6    | 96  | `styles/tokens.css:52` |
| `--sr-space-12` | 7    | 112 | `styles/tokens.css:53` |

#### Guest Spacing Scale

| Token               | rem  | px  | Source                    |
| ------------------- | ---- | --- | ------------------------- |
| `--guest-space-xs`  | 0.5  | 8   | `src/app/globals.css:273` |
| `--guest-space-sm`  | 0.75 | 12  | `src/app/globals.css:275` |
| `--guest-space-md`  | 1    | 16  | `src/app/globals.css:277` |
| `--guest-space-lg`  | 1.5  | 24  | `src/app/globals.css:279` |
| `--guest-space-xl`  | 2    | 32  | `src/app/globals.css:281` |
| `--guest-space-2xl` | 2.5  | 40  | `src/app/globals.css:283` |
| `--guest-space-3xl` | 3    | 48  | `src/app/globals.css:285` |

#### Named Spacing

| Token                       | Value   | Source                    |
| --------------------------- | ------- | ------------------------- |
| `--screen-margin`           | 1rem    | `tailwind.config.js:191`  |
| `--card-padding`            | 1.5rem  | `tailwind.config.js:192`  |
| `--button-height`           | 2.75rem | `tailwind.config.js:193`  |
| `--touch-target`            | 44px    | `tailwind.config.js:194`  |
| `--guest-section-gap`       | 2.5rem  | `src/app/globals.css:289` |
| `--guest-section-padding-x` | 1.5rem  | `src/app/globals.css:291` |
| `--guest-card-padding`      | 1.5rem  | `src/app/globals.css:295` |

#### Containers

| Utility                           | Max Width                  | Source                        |
| --------------------------------- | -------------------------- | ----------------------------- |
| `.container-narrow`               | 48rem (768px)              | `src/app/globals.css:899-902` |
| `.container-default`              | 70rem (1120px)             | `src/app/globals.css:904-907` |
| `.container-wide`                 | 90rem (1440px)             | `src/app/globals.css:909-912` |
| `.guest-page` / `.guest-boundary` | 70rem + responsive padding | `src/app/globals.css:919-948` |
| `.sr-container`                   | min(100%, 72rem)           | `styles/tokens.css:78-81`     |

#### Breakpoints

Tailwind v4 default breakpoints are used. Guest responsive padding scales at `640px` (sm) and `1024px` (lg) — `src/app/globals.css:933-948`.

---

### Shape (Border Radius)

#### Base Scale

| Token                        | Value  | Source                    |
| ---------------------------- | ------ | ------------------------- |
| `--radius-sm`                | 8px    | `styles/base.css:121`     |
| `--radius-base` / `--radius` | 12px   | `styles/base.css:115,120` |
| `--radius-lg`                | 16px   | `styles/base.css:116`     |
| `--radius-pill`              | 9999px | `styles/base.css:117`     |

#### Guest Scale

| Token                 | Value          | Source                    |
| --------------------- | -------------- | ------------------------- |
| `--guest-radius-sm`   | 0.5rem (8px)   | `src/app/globals.css:327` |
| `--guest-radius-md`   | 0.75rem (12px) | `src/app/globals.css:328` |
| `--guest-radius-lg`   | 1rem (16px)    | `src/app/globals.css:329` |
| `--guest-radius-xl`   | 1.5rem (24px)  | `src/app/globals.css:330` |
| `--guest-radius-2xl`  | 2rem (32px)    | `src/app/globals.css:331` |
| `--guest-radius-full` | 9999px         | `src/app/globals.css:332` |

---

### Elevation (Shadows)

#### Base Shadows

| Token         | Light Value                                            | Dark Value | Source                    |
| ------------- | ------------------------------------------------------ | ---------- | ------------------------- |
| `--shadow-sm` | `0 1px 2px 0 rgb(0 0 0 / 0.05)`                        | `…/ 0.3`   | `styles/base.css:126,199` |
| `--shadow`    | `0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px …`       | `…/ 0.4`   | `styles/base.css:127,200` |
| `--shadow-md` | `0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px …`    | `…/ 0.4`   | `styles/base.css:128,201` |
| `--shadow-lg` | `0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px …`  | `…/ 0.4`   | `styles/base.css:129,202` |
| `--shadow-xl` | `0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px …` | `…/ 0.4`   | `styles/base.css:130,203` |

#### Named Shadows

| Tailwind Class  | Token / Value                           | Source                   |
| --------------- | --------------------------------------- | ------------------------ |
| `shadow-card`   | `var(--shadow-card, var(--shadow-md))`  | `tailwind.config.js:250` |
| `shadow-header` | `0 1px 3px 0 rgb(0 0 0 / 0.1)`          | `tailwind.config.js:251` |
| `shadow-modal`  | `var(--shadow-modal, var(--shadow-xl))` | `tailwind.config.js:252` |

#### Guest Shadows (layered)

| Token                 | Value                                 | Source                        |
| --------------------- | ------------------------------------- | ----------------------------- |
| `--guest-shadow-xs`   | Single layer, 0.04 alpha              | `src/app/globals.css:338`     |
| `--guest-shadow-sm`   | 2 layers, 0.04–0.06                   | `src/app/globals.css:339-340` |
| `--guest-shadow-md`   | 2 layers, 0.04–0.08                   | `src/app/globals.css:341-343` |
| `--guest-shadow-lg`   | 2 layers, 0.06–0.1                    | `src/app/globals.css:344-345` |
| `--guest-shadow-xl`   | 2 layers, 0.08–0.12                   | `src/app/globals.css:346-348` |
| `--guest-shadow-glow` | `0 0 24px hsl(var(--primary) / 0.25)` | `src/app/globals.css:349`     |

#### Guest Enhanced Shadows (3-layer)

| Token                 | Source                                   |
| --------------------- | ---------------------------------------- |
| `--shadow-card`       | `styles/themes/guest-enhanced.css:31-33` |
| `--shadow-card-hover` | `styles/themes/guest-enhanced.css:35-37` |
| `--shadow-featured`   | `styles/themes/guest-enhanced.css:39-41` |

---

### Motion

#### Transition Durations

| Token  | Value | Source                   |
| ------ | ----- | ------------------------ |
| `fast` | 150ms | `tailwind.config.js:364` |
| `base` | 200ms | `tailwind.config.js:365` |
| `slow` | 300ms | `tailwind.config.js:366` |

#### Easing Curves

| Token           | Value                            | Source                                |
| --------------- | -------------------------------- | ------------------------------------- |
| `srx-standard`  | `cubic-bezier(0.22, 1, 0.36, 1)` | `tailwind.config.js:359`              |
| `guest-ease`    | `cubic-bezier(0.2, 0, 0, 1)`     | `tailwind.config.js:360`              |
| `--ease-out`    | `cubic-bezier(0.16, 1, 0.3, 1)`  | `styles/themes/guest-enhanced.css:49` |
| `--ease-in-out` | `cubic-bezier(0.45, 0, 0.55, 1)` | `styles/themes/guest-enhanced.css:51` |

#### Guest Transition Shorthands

| Token                     | Value            | Source                    |
| ------------------------- | ---------------- | ------------------------- |
| `--guest-transition-fast` | `150ms ease-out` | `src/app/globals.css:352` |
| `--guest-transition-base` | `200ms ease-out` | `src/app/globals.css:353` |
| `--guest-transition-slow` | `300ms ease-out` | `src/app/globals.css:354` |

#### Interactive States

| Token                  | Value  | Source                    |
| ---------------------- | ------ | ------------------------- |
| `--guest-hover-lift`   | `-2px` | `src/app/globals.css:358` |
| `--guest-hover-scale`  | `1.02` | `src/app/globals.css:359` |
| `--guest-active-scale` | `0.98` | `src/app/globals.css:360` |

#### Keyframe Animations (14 defined)

| Name                | Duration | Easing       | Type     | Source                       |
| ------------------- | -------- | ------------ | -------- | ---------------------------- |
| `fade-in`           | 0.2s     | ease-out     | Entrance | `tailwind.config.js:268-270` |
| `fade-up`           | 0.3s     | ease-out     | Entrance | `tailwind.config.js:271-274` |
| `fade-down`         | 0.3s     | ease-out     | Entrance | `tailwind.config.js:275-278` |
| `scale-in`          | 0.2s     | ease-out     | Entrance | `tailwind.config.js:279-282` |
| `slide-up`          | 0.3s     | ease-out     | Entrance | `tailwind.config.js:283-286` |
| `slide-down`        | 0.3s     | ease-out     | Entrance | `tailwind.config.js:287-290` |
| `slide-in-right`    | 0.3s     | ease-out     | Entrance | `tailwind.config.js:291-294` |
| `appear-from-right` | 0.3s     | ease-in-out  | Entrance | `tailwind.config.js:295-298` |
| `shimmer`           | 2s       | ease-in-out  | Loop     | `tailwind.config.js:299-302` |
| `pulse-glow`        | 2s       | cubic-bezier | Loop     | `tailwind.config.js:303-306` |
| `wiggle`            | 1.5s     | ease-in-out  | Loop     | `tailwind.config.js:307-314` |
| `popup`             | 0.25s    | ease-in-out  | Entrance | `tailwind.config.js:315-319` |
| `celebrate`         | 0.6s     | spring curve | Delight  | `tailwind.config.js:320-324` |
| `shake`             | 0.5s     | ease-in-out  | Feedback | `tailwind.config.js:325-329` |

All animations use **only `transform` and `opacity`** for GPU acceleration.

#### Reduced Motion

`prefers-reduced-motion: reduce` is respected globally — all animations and transitions set to `0.01ms`. Sources: `styles/base.css:224-236`, `reserve/app/responsive.css:23-31`, `src/app/globals.css:398-410`.

---

### Other Tokens

#### Z-Index

No formal z-index scale is defined. Observed usage: `z-50` for overlays (dialogs, popovers, tooltips, sheets, dropdown menus). Source: component files in `components/ui/`.

#### Opacity

`disabled:opacity-50` is the standard disabled opacity across all interactive components. Source: `components/ui/button.tsx:8`, `components/ui/input.tsx:11`, etc.

#### Icon Sizing

Default icon size in buttons: `size-4` (16px) via `[&_svg:not([class*='size-'])]:size-4`. Guest icon boxes: 2.5rem (40px) and 3rem (48px). Source: `components/ui/button.tsx:8`, `src/components/guest/ui/GuestPrimitives.tsx:119-135`.

---

## Components

See [component-inventory.md](../../component-inventory.md) for the full catalog.

### Primitives (`components/ui/`) — 31 components

All are shadcn/ui (new-york style) built on Radix UI + CVA + Tailwind. Core pattern:

```tsx
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
```

**Key components and their variants:**

| Component        | Variants                                                        | States                                 | Source                            |
| ---------------- | --------------------------------------------------------------- | -------------------------------------- | --------------------------------- |
| **Button**       | default, destructive, outline, secondary, ghost, link × 6 sizes | disabled, hover, active, focus-visible | `components/ui/button.tsx`        |
| **Card**         | default, featured, interactive, compact                         | hover (interactive)                    | `components/ui/card.tsx`          |
| **Badge**        | default, secondary, destructive, outline + 5 domain variants    | hover                                  | `components/ui/badge.tsx`         |
| **Alert**        | default, destructive, info, success, warning                    | —                                      | `components/ui/alert.tsx`         |
| **Dialog**       | —                                                               | open/closed (animated)                 | `components/ui/dialog.tsx`        |
| **Sheet**        | side: right/left/top/bottom                                     | open/closed (slide)                    | `components/ui/sheet.tsx`         |
| **DropdownMenu** | item: default, destructive                                      | disabled, focus                        | `components/ui/dropdown-menu.tsx` |
| **Tabs**         | —                                                               | active/inactive (shadow)               | `components/ui/tabs.tsx`          |

### Guest Primitives (`src/components/guest/ui/`) — 12 components

Higher-level compounds for guest-facing pages. Use the shadcn Button internally. Provide semantic slots (eyebrow, header, footer, actions). Source: `src/components/guest/ui/GuestPrimitives.tsx`.

### Reserve Primitives (`reserve/shared/ui/`) — 19 components

Parallel set for the Vite-powered Reserve app. Includes a `Field.tsx` form wrapper specific to the reservation flow. Source: `reserve/shared/ui/`.

---

## Theming

### Strategy

```
<html data-theme="app|guest" class="dark?">
```

| Mechanism      | Selector                         | Purpose                        | Source                             |
| -------------- | -------------------------------- | ------------------------------ | ---------------------------------- |
| Base tokens    | `:root`                          | Default app palette            | `src/app/globals.css:26-146`       |
| Dark mode      | `.dark`                          | Inverted palette               | `src/app/globals.css:148-213`      |
| App theme      | `[data-theme='app']`             | Compact spacing/text           | `styles/themes/app.css`            |
| Guest theme    | `[data-theme='guest']`           | Blue/coral palette             | `styles/themes/guest.css`          |
| Guest class    | `.guest-theme`                   | Legacy class-based overrides   | `src/app/globals.css:216-361`      |
| Guest enhanced | `[data-theme='guest']` (layered) | Warm surfaces, shadows, motion | `styles/themes/guest-enhanced.css` |

### Dark Mode

Configured as `darkMode: ["class"]` in `tailwind.config.js:11`. Tailwind v4 custom variant: `@custom-variant dark (&:is(.dark *))` in `src/app/globals.css:12`.

Both `[data-theme].dark` and `.dark[data-theme]` selectors are defined for theme×mode combinations in `styles/themes/guest.css:82-84` and `styles/themes/guest-enhanced.css:267-269`.

### Sidebar Tokens

Sidebar uses **oklch** color space (separate from HSL system). Light: `oklch(0.985 0 0)` background. Dark: `oklch(0.205 0 0)`. Source: `styles/base.css:93-101`, `src/app/globals.css:102-109`.

---

## Accessibility

| Feature                 | Implementation                                                                      | Source                                              |
| ----------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------- |
| **Reduced motion**      | `prefers-reduced-motion: reduce` → 0.01ms animations/transitions                    | `styles/base.css:224-236`                           |
| **Touch targets**       | 44px min on buttons, checkboxes, radios                                             | `styles/base.css:286-292`                           |
| **Touch action**        | `touch-action: manipulation` on interactive elements                                | `styles/base.css:274-283`                           |
| **iOS zoom prevention** | `font-size: 16px` on inputs                                                         | `styles/base.css:316-320`                           |
| **Screen reader**       | `.sr-only` utility class                                                            | `styles/base.css:299-309`                           |
| **Focus rings**         | `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`          | Components in `components/ui/`                      |
| **Dialog close**        | `<span className="sr-only">Close</span>`                                            | `components/ui/dialog.tsx:58`                       |
| **Form errors**         | `role="alert"` on FormMessage, `aria-invalid` on inputs, `aria-describedby` linking | `components/ui/form.tsx:117-124,162`                |
| **Alert role**          | `role="alert"` on Alert component                                                   | `components/ui/alert.tsx:33`                        |
| **Status role**         | `role="status"` + `tabIndex={-1}` on GuestStatus                                    | `src/components/guest/ui/GuestPrimitives.tsx:326`   |
| **Semantic headings**   | HeadingXL→h1, HeadingLG→h2, HeadingMD→h3                                            | `src/components/guest/ui/GuestPrimitives.tsx:19-47` |
| **Text wrapping**       | `text-wrap: pretty` on `<p>`, `overflow-wrap: anywhere`                             | `src/app/globals.css:441-448`                       |
| **Tap highlight**       | `-webkit-tap-highlight-color: hsl(var(--primary) / 0.1)`                            | `styles/base.css:281`                               |

---

## Patterns & Conventions

### CSS Composition

```tsx
// Universal pattern — cn() from lib/utils.ts
import { cn } from '@/lib/utils';
cn('base-classes', conditional && 'conditional-class', className)

// Multi-variant components — CVA
const variants = cva('base', { variants: { … }, defaultVariants: { … } });
```

### Naming

- **Components**: PascalCase, named exports (`Button`, `GuestCard`)
- **CVA variants**: lowercase kebab-case (`status-confirmed`, `icon-sm`)
- **CSS variables**: `--semantic-name` (core), `--guest-*` (guest), `--sr-*` (legacy)
- **Files**: kebab-case for shadcn (`button.tsx`), PascalCase for custom (`GuestPrimitives.tsx`)
- **data-slot**: Used on newer shadcn components for CSS targeting (`data-slot="button"`)

### Form Validation

react-hook-form + zod schema validation → `@hookform/resolvers`. FormMessage renders errors with `role="alert"`. Source: `components/ui/form.tsx`.

### Icon System

Lucide React. In buttons: default `size-4` via selector `[&_svg:not([class*='size-'])]:size-4`. Icon-only button sizes: `icon` (36px), `icon-sm` (32px), `icon-lg` (40px). Source: `components/ui/button.tsx:8,26-28`.

### Dark Mode

Class-based `.dark` on `<html>`. Components use Tailwind dark variants:

```tsx
'dark:bg-input/30 dark:border-input dark:hover:bg-input/50';
```

### Container Strategy

Three container widths + safe-area-aware guest container with responsive padding breakpoints at 640px and 1024px. Source: `src/app/globals.css:896-948`.

### Stagger Animations

`.guest-stagger` — nth-child delays at 50ms intervals (0–250ms). `[data-theme='guest'] .stagger-container` — 80ms intervals (0–400ms). Source: `src/app/globals.css:1151-1177`, `styles/themes/guest-enhanced.css:212-243`.

### Deprecated Patterns

Marked in source with `DEPRECATED` comments and migration guidance:

- `.guest-card-base` / `.guest-card-interactive` → Use GuestCard component or Tailwind — `src/app/globals.css:963-971`
- `.guest-btn-primary` → Use Button variant with `rounded-full` — `src/app/globals.css:1010-1025`

---

## Gaps & Recommendations

### 1. Token Duplication (High)

Color tokens are defined identically in **both** `styles/base.css` AND `src/app/globals.css`. This doubles maintenance risk.

**Recommendation**: Consolidate to a single file (`styles/base.css`) and import it from `globals.css`. Remove duplicate declarations.

### 2. Dual Guest Theming Mechanism (Medium)

Guest theme is applied via both `[data-theme='guest']` CSS selectors AND `.guest-theme` class overrides in `src/app/globals.css:216-361`. This creates confusion about which mechanism is canonical.

**Recommendation**: Standardize on `[data-theme='guest']` and migrate `.guest-theme` class consumers.

### 3. Three Parallel Component Sets (Medium)

`components/ui/` (shadcn), `reserve/shared/ui/` (19 components), and `src/components/guest/ui/` each maintain similar primitives independently.

**Recommendation**: Document which set is canonical for each surface. Plan convergence for shared primitives (Button, Card, Input, etc.).

### 4. Hardcoded Colors in Guest Primitives (Medium)

`src/components/guest/ui/GuestPrimitives.tsx` uses raw Tailwind colors (`text-slate-900`, `bg-blue-50`, `bg-blue-600`) instead of semantic tokens.

**Recommendation**: Migrate to semantic tokens (`text-foreground`, `bg-primary`, etc.) for theme consistency.

### 5. Animation Definition Triplication (Low)

Keyframes are defined in `tailwind.config.js`, `styles/animations.css`, AND `src/app/globals.css`. Source comments acknowledge this is intentional, but it triples drift risk.

**Recommendation**: Use `tailwind.config.js` as single source of truth. Remove CSS duplicates or auto-generate them.

### 6. Legacy SR Tokens Without Migration Timeline (Low)

`--sr-*` aliases in `styles/tokens.css` and `sr-*` Tailwind mappings in `tailwind.config.js:117-126,229-233` are marked as "deprecation path" with no concrete removal date.

**Recommendation**: Set a migration deadline and track remaining usages.

### 7. Missing Component States (Low)

- Badge: no loading state
- Card interactive: no disabled state
- Switch: no loading indicator

**Recommendation**: Add missing states to match the full state matrix.

### 8. No Z-Index Scale (Low)

No formal z-index token system. Components use `z-50` for overlays.

**Recommendation**: Define a z-index scale (e.g., base=0, dropdown=10, sticky=20, overlay=30, modal=40, toast=50).

### 9. Sidebar oklch Inconsistency (Low)

Sidebar tokens use `oklch()` while everything else uses HSL. This creates a color-space inconsistency.

**Recommendation**: Document the rationale or migrate sidebar tokens to HSL for consistency.

### 10. Hardcoded Shadows in Guest Components (Low)

Some guest components use raw shadow strings (`shadow-[0_1px_2px_rgba(0,0,0,0.05)]`) instead of tokenized `--guest-shadow-*` values.

**Recommendation**: Migrate to token-based shadows consistently.

### 11. `@ts-expect-error` in ActionCard (Low)

`src/components/guest/ui/GuestPrimitives.tsx:213` suppresses a TypeScript error.

**Recommendation**: Fix the type narrowing for the `Link | button` conditional wrapper pattern.

---

## Appendix: File Map

```
src/app/globals.css              ← Master CSS entry point
styles/
├── base.css                     ← :root tokens, resets, a11y
├── tokens.css                   ← SR-prefixed aliases, spacing
├── animations.css               ← Keyframe definitions
├── guest-design-system.css      ← Guest utility bridge
└── themes/
    ├── app.css                  ← App theme overrides
    ├── guest.css                ← Guest palette
    └── guest-enhanced.css       ← Guest warm surfaces & motion
tailwind.config.js               ← Tailwind extensions
components.json                  ← shadcn/ui config
lib/utils.ts                     ← cn() helper
components/ui/                   ← 31 shadcn/ui primitives
src/components/guest/ui/         ← 12 guest compound components
reserve/shared/ui/               ← 19 reserve-app primitives
reserve/.storybook/              ← Storybook 10 config
```

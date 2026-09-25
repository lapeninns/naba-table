---
version: alpha
name: Radix Luma
description: A dual-mode design system built on Zinc neutrals and a singular cobalt-blue accent, optimized for clarity, restraint, and professional density.
colors:
  # ── Light mode surfaces ──
  background: '#ffffff'
  foreground: '#09090b'
  card: '#ffffff'
  card-foreground: '#09090b'
  popover: '#ffffff'
  popover-foreground: '#09090b'
  # ── Semantic roles ──
  primary: '#1447e6'
  on-primary: '#eff6ff'
  secondary: '#f4f4f5'
  secondary-foreground: '#18181b'
  muted: '#f4f4f5'
  muted-foreground: '#71717b'
  accent: '#f4f4f5'
  accent-foreground: '#18181b'
  destructive: '#e7000b'
  # ── Structural ──
  border: '#e4e4e7'
  input: '#e4e4e7'
  ring: '#9f9fa9'
  # ── Sidebar ──
  sidebar: '#fafafa'
  sidebar-foreground: '#09090b'
  sidebar-primary: '#155dfc'
  sidebar-primary-foreground: '#eff6ff'
  sidebar-accent: '#f4f4f5'
  sidebar-accent-foreground: '#18181b'
  sidebar-border: '#e4e4e7'
  sidebar-ring: '#9f9fa9'
  # ── Chart palette (monochromatic blue ramp) ──
  chart-1: '#8ec5ff'
  chart-2: '#2b7fff'
  chart-3: '#155dfc'
  chart-4: '#1447e6'
  chart-5: '#193cb8'
  # ── Dark mode surfaces ──
  dark-background: '#09090b'
  dark-foreground: '#fafafa'
  dark-card: '#18181b'
  dark-card-foreground: '#fafafa'
  dark-popover: '#18181b'
  dark-popover-foreground: '#fafafa'
  dark-primary: '#193cb8'
  dark-on-primary: '#eff6ff'
  dark-secondary: '#27272a'
  dark-secondary-foreground: '#fafafa'
  dark-muted: '#27272a'
  dark-muted-foreground: '#9f9fa9'
  dark-accent: '#27272a'
  dark-accent-foreground: '#fafafa'
  dark-destructive: '#ff6467'
  dark-border: '#27272a'
  dark-input: '#3f3f46'
  dark-ring: '#71717b'
  dark-sidebar: '#18181b'
  dark-sidebar-foreground: '#fafafa'
  dark-sidebar-primary: '#2b7fff'
  dark-sidebar-primary-foreground: '#eff6ff'
  dark-sidebar-accent: '#27272a'
  dark-sidebar-accent-foreground: '#fafafa'
  # ── Ambient glow base colors (apply at 8–15% opacity in CSS) ──
  glow-primary: '#1447e6'
  glow-neutral: '#09090b'
typography:
  display:
    fontFamily: Merriweather
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Merriweather
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Merriweather
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  title-lg:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
  eyebrow:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.08em
  button:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  mono:
    fontFamily: Geist Mono
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
rounded:
  # Restrained scale ratified in docs/design/luma-2.0-spec.md §4.5 (ceiling 20px).
  sm: 0.375rem
  DEFAULT: 0.5rem
  lg: 0.625rem
  xl: 0.75rem
  2xl: 0.875rem
  3xl: 1rem
  4xl: 1.25rem
  pill: 9999px
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  2xl: 64px
  3xl: 96px
  4xl: 128px
  container-padding: 24px
  container-padding-md: 48px
  container-padding-lg: 96px
  section-gap: 40px
  bento-gap: 16px
layout:
  breakpoint-sm: 640px
  breakpoint-md: 768px
  breakpoint-lg: 1024px
  breakpoint-xl: 1280px
  breakpoint-2xl: 1536px
  container-max: 1280px
  container-narrow: 768px
  container-wide: 1536px
  grid-columns: 12
  grid-gutter: 16px
  grid-gutter-lg: 24px
  touch-target-min: 44px
  line-length-max: 65ch
  sidebar-width: 256px
  nav-height: 48px
shadow:
  sm: 0 1px 2px rgba(9, 9, 11, 0.05)
  DEFAULT: 0 1px 3px rgba(9, 9, 11, 0.1), 0 1px 2px rgba(9, 9, 11, 0.06)
  md: 0 4px 6px -1px rgba(9, 9, 11, 0.1), 0 2px 4px -2px rgba(9, 9, 11, 0.1)
  lg: 0 10px 15px -3px rgba(9, 9, 11, 0.1), 0 4px 6px -4px rgba(9, 9, 11, 0.1)
  xl: 0 20px 25px -5px rgba(9, 9, 11, 0.1), 0 8px 10px -6px rgba(9, 9, 11, 0.1)
  nav-float: 0 8px 30px rgba(9, 9, 11, 0.04)
  button-glow: 0 10px 15px -3px rgba(20, 71, 230, 0.15)
  popover: 0 10px 38px -10px rgba(9, 9, 11, 0.35), 0 10px 20px -15px rgba(9, 9, 11, 0.2)
motion:
  easing-default: cubic-bezier(0.25, 0.1, 0.25, 1)
  easing-spring: cubic-bezier(0.22, 1, 0.36, 1)
  easing-bounce: cubic-bezier(0.34, 1.56, 0.64, 1)
  duration-fast: 150ms
  duration-default: 250ms
  duration-slow: 500ms
  duration-reveal: 800ms
components:
  button-primary:
    backgroundColor: '{colors.primary}'
    textColor: '{colors.on-primary}'
    typography: '{typography.button}'
    rounded: '{rounded.pill}'
    height: 36px
    padding: 0 12px
  button-primary-hover:
    backgroundColor: '#1240cf'
  button-secondary:
    backgroundColor: '{colors.secondary}'
    textColor: '{colors.secondary-foreground}'
    typography: '{typography.button}'
    rounded: '{rounded.pill}'
    height: 36px
    padding: 0 12px
  button-secondary-hover:
    backgroundColor: '#e8e8ea'
  button-outline:
    backgroundColor: '{colors.background}'
    textColor: '{colors.foreground}'
    typography: '{typography.button}'
    rounded: '{rounded.pill}'
    height: 36px
    padding: 0 12px
  button-ghost:
    backgroundColor: transparent
    textColor: '{colors.foreground}'
    typography: '{typography.button}'
    rounded: '{rounded.pill}'
  button-ghost-hover:
    backgroundColor: '{colors.muted}'
  button-destructive:
    backgroundColor: '#fef2f2'
    textColor: '#c10007'
    typography: '{typography.button}'
    rounded: '{rounded.pill}'
  button-link:
    backgroundColor: transparent
    textColor: '{colors.primary}'
    typography: '{typography.button}'
  card-standard:
    backgroundColor: '{colors.card}'
    textColor: '{colors.card-foreground}'
    rounded: '{rounded.lg}'
  popover:
    backgroundColor: '{colors.popover}'
    textColor: '{colors.popover-foreground}'
    rounded: '{rounded.DEFAULT}'
  input-field:
    backgroundColor: '{colors.background}'
    textColor: '{colors.foreground}'
    typography: '{typography.body-sm}'
    rounded: '{rounded.DEFAULT}'
    height: 36px
    padding: 0 12px
  input-field-focus:
    backgroundColor: '{colors.background}'
  badge-secondary:
    backgroundColor: '{colors.secondary}'
    textColor: '{colors.secondary-foreground}'
    typography: '{typography.label-sm}'
    rounded: '{rounded.full}'
    padding: 2px 10px
---

# Radix Luma — Nabatable design system

This is the single design system for every Nabatable surface. The front matter above holds the
brand token values; the sections below explain how to use them.

## Document map

| Need                                                   | Source of truth                                                                |
| ------------------------------------------------------ | ------------------------------------------------------------------------------ |
| Brand values, type, spacing, motion, component rules   | **This file**                                                                  |
| Brand identity: name, logo, voice                      | [`BRAND.md`](BRAND.md)                                                         |
| Design decisions and open questions                    | [`docs/design/luma-2.0-spec.md`](docs/design/luma-2.0-spec.md)                 |
| Token reference (CSS variables and Tailwind utilities) | [`docs/DESIGN_TOKENS.md`](docs/DESIGN_TOKENS.md)                               |
| Machine-readable tokens (generated)                    | [`docs/tokens.json`](docs/tokens.json) — `pnpm design:tokens-json`             |
| Token implementation                                   | `styles/design-system/public-guest.tokens.css`, `src/app/globals.css`          |
| Shared components                                      | `components/ui/**` (shadcn on Radix)                                           |
| Restaurant-settings ops screens                        | [`docs/design/ops-settings-contract.md`](docs/design/ops-settings-contract.md) |
| Terminology (for example "Booking", not "Reservation") | [`docs/design-notes.md`](docs/design-notes.md)                                 |

**One system, two surfaces.** The same tokens and components serve both surfaces. `data-theme`
selects between them:

- `guest` — public booking pages: Merriweather display headings, warmer and roomier.
- `app` — the ops dashboard: Inter throughout, compact density.

Dark mode (`.dark`) works independently of either surface. CI guards (`guard:luma`,
`guard:no-shadcn`, `guard:typography-scale`, `guard:no-shadow-roots`) block drift; see
`README.md` → "Design-system invariants".

Older documents live in [`docs/design/archive/`](docs/design/archive/) and are not current.

## Brand & Style

Radix Luma is a restrained, professionally dense interface system. The Zinc-based neutral palette provides an institutional backbone while a singular cobalt-blue accent (#1447E6) drives all interactive affordance. The mood is clinical yet warm — like a well-organized studio where every tool has its place.

The system supports full light/dark mode duality with **light mode as the default**. On first load, the UI renders in light mode regardless of OS preference. Users can manually toggle via the `d` keyboard shortcut. The chosen theme is persisted in `localStorage` so subsequent visits respect the override. Theme switching is instantaneous — `disableTransitionOnChange` prevents the flash of intermediate states. In light mode, surfaces are pure white with Zinc-100 tonal layers for secondary regions. In dark mode, surfaces shift to Zinc-950/900 with translucent white borders (10% opacity) that create subtle edge definition without harsh contrast.

Headlines use **Merriweather**, a distinctive serif that adds editorial weight and visual authority to display-level content. All body, label, and interface text uses **Inter** for its neutral geometric clarity and excellent small-size legibility. **Geist Mono** is reserved for code snippets, metadata, and technical labels.

The overall density sits at 10/10 — cockpit-dense. Every pixel earns its place. Layouts pack maximum information into minimum space while maintaining strict visual hierarchy through weight, color, and type scale — never through whitespace alone.

### Apple Design Principles

This system is governed by the five foundational principles from Apple's Human Interface Guidelines:

1. **Aesthetic Integrity.** The visual style matches the function. A data-dense dashboard uses tight spacing and monospace numbers. A marketing hero uses generous padding and display type. Never apply one mood to the other's context.
2. **Consistency.** Every screen uses the same tokens, the same type scale, the same radius profiles. Identical components look identical everywhere. Users never have to relearn an interface pattern.
3. **Direct Manipulation.** Interactive elements respond immediately to input. Buttons depress on touch. Cards lift on hover. Focus rings appear instantly. The UI feels physical.
4. **Feedback.** Every action produces a visible response. State changes animate. Errors surface inline with the destructive color. Success confirms with a brief visual shift. Silence is never an answer.
5. **User Control.** Theme preference is persisted but always overridable. Animations respect `prefers-reduced-motion`. Nothing auto-plays. Nothing traps scroll. The user is always in charge.

## Colors

The palette is anchored in the Zinc neutral scale — a cool gray family with a subtle blue-purple undertone (hue ~286 in oklch) that avoids the muddy warmth of true grays.

### Semantic Color Roles

Following Apple's approach, every color is defined by its **semantic purpose**, not its appearance. Never redefine a semantic color's role — the `border` color is always for borders, never for text; the `destructive` color is always for errors, never for emphasis.

- **Background (#FFFFFF / dark: #09090B):** The primary canvas. Pure white in light mode; near-black Zinc-950 in dark mode.
- **Foreground (#09090B / dark: #FAFAFA):** Primary text. Maximum contrast against the background.
- **Primary — Cobalt Blue (#1447E6):** The sole accent color. Used exclusively for primary CTAs, active states, focus rings, and interactive highlights. In dark mode this shifts to a deeper #193CB8 to maintain perceptual balance against dark surfaces.
- **Muted (#F4F4F5 / dark: #27272A):** Zinc-100/800. Used for secondary surfaces, hover states on ghost buttons, and inactive regions.
- **Muted Foreground (#71717B / dark: #9F9FA9):** Zinc-500/400. For secondary text, descriptions, placeholders, and metadata.
- **Border (#E4E4E7 / dark: 10% white):** Structural 1px lines for dividers, input borders, and card edges. Equivalent to Apple's `separator` dynamic color.
- **Destructive (#E7000B / dark: #FF6467):** A saturated red for error states and destructive actions. Applied sparingly in 10% tinted fills with full-chroma text. Never assigned to a primary button role — per Apple HIG, destructive actions must never receive the most visually prominent style to prevent accidental invocation.
- **Chart Palette:** A monochromatic blue ramp from light periwinkle (#8EC5FF) through the primary cobalt to deep navy (#193CB8), ensuring data visualizations feel cohesive with the brand accent.
- **Glow Effects:** Ambient cobalt tints at 8% and 15% opacity for hover backgrounds and button glow shadows. A 6% neutral glow for soft card elevation.

### Appearance Adaptation

All colors define explicit light and dark variants. Colors shift in both luminosity and chroma between modes — they are re-tuned, not simply inverted. This follows Apple's principle that dark mode is not an inversion but a separate, intentionally designed appearance. When Increase Contrast is enabled, border opacity doubles and muted-foreground shifts one step darker to exceed WCAG AAA ratios.

### Color Independence

Color must never be the sole indicator of meaning. Error states combine the destructive color with an error icon and inline text. Active navigation items combine the primary color with a bold weight shift. Chart segments supplement color with pattern fills or direct labels. This ensures the interface remains fully usable for people with color blindness.

## Typography

The type system pairs a characterful serif for headlines with a workhorse sans-serif for everything else. Like Apple's SF Pro / New York pairing, the system uses two typeface families with complementary roles.

### Type Scale & Hierarchy

Following Apple's text style model, each tier in the type scale has a defined semantic role. The hierarchy is communicated through weight and size together — never size alone.

- **Display (Merriweather, 48px, 700):** Page titles and hero headlines. Tight tracking (-0.02em) mirrors Apple's SF Pro behavior at large sizes, where tracking decreases as size increases. Used once per page maximum.
- **Headline-lg (Merriweather, 36px, 700):** Section headers. Slight negative tracking (-0.01em).
- **Headline-md (Merriweather, 24px, 700):** Subsection headers and card titles.
- **Title-lg (Inter, 20px, 600):** Tertiary headings within dense content areas.
- **Body-lg (Inter, 18px, 400):** Featured body text — pull quotes, hero descriptions. Leading of 28px (1.56×) provides a comfortable reading rhythm.
- **Body-md (Inter, 16px, 400):** Standard body text. 24px leading (1.5×). Maximum 65 characters per line. This is the baseline — all other sizes exist in relation to it.
- **Body-sm (Inter, 14px, 400):** Dense content — table cells, compact lists, helper text.
- **Eyebrow (Inter, 12px, 600):** Small uppercase labels above headlines. Ultra-wide tracking (0.08em) creates visual separation from surrounding content. Always rendered in muted-foreground.
- **Button (Inter, 14px, 600):** Dedicated interactive tier. Slight tracking (0.01em) ensures legibility within the capsule button shape.
- **Label-md / Label-sm (Inter, 14/12px, 500):** Form labels, metadata, navigation. Medium weight distinguishes labels from body text at the same size.
- **Mono (Geist Mono, 12px, 400):** Code, timestamps, technical values. Monospace ensures tabular alignment for numbers and data.

### Dynamic Sizing

Display and headline tiers scale fluidly using `clamp()` — text feels proportional at every viewport width without jarring breakpoint jumps. This parallels Apple's Dynamic Type system, where text scales proportionally rather than in discrete steps:

- **Display:** `clamp(32px, 5vw, 48px)`.
- **Headline-lg:** `clamp(28px, 4vw, 36px)`.
- **Headline-md:** `clamp(20px, 3vw, 24px)`.
- **Body-md:** Fixed at 16px across all viewports. Never scales — readability is non-negotiable. This matches Apple's guideline that body text maintains a consistent baseline size.

### Font Weight Discipline

Per Apple's typography guidance, thicker weights improve legibility at small sizes while thinner weights require larger sizes. This system uses only four weights: 400 (Regular) for body, 500 (Medium) for labels, 600 (Semi-bold) for buttons/eyebrows, and 700 (Bold) for headlines. Never use more than two weights on a single screen to maintain visual calm.

### Tracking Behavior

Following Apple's SF Pro tracking tables, tracking is inversely proportional to size: positive at small sizes (eyebrow +0.08em at 12px), neutral at body (0 at 16px), negative at display (-0.02em at 48px). This ensures consistent optical density across the scale.

## Layout & Spacing

The layout system follows Apple's approach: content centered within safe areas, progressive margin scaling, and fluid adaptation at every breakpoint. Every dimension is derived from an 8px base grid with a 4px half-step for micro-adjustments.

### Container Strategy

Content is centered within a maximum width and padded with progressively larger margins as the viewport grows — the same pattern Apple uses on apple.com to keep content focused and never edge-to-edge.

- **Container Max Width:** 1280px. All primary content is constrained within this boundary. On ultra-wide displays, the canvas background extends to fill the viewport while content remains centered.
- **Narrow Container:** 768px. Used for text-heavy sections (articles, documentation, legal) to maintain the 65-character line-length maximum.
- **Wide Container:** 1536px. Used sparingly for full-bleed hero sections or media-heavy layouts.
- **Container Padding:** Scales with viewport — 24px on mobile, 48px on tablets, 96px on desktop. This follows Apple's margin scaling principle: small screens use tight margins to maximize content area; large screens use generous margins to maintain a focused reading width.

### Breakpoints & Responsive Architecture

The system uses five breakpoints. Each defines a complete layout reconfiguration, not just minor adjustments. Following Apple's adaptive layout model, the interface is redesigned for each size class rather than merely reflowed:

| Breakpoint | Width    | Grid Columns | Container Padding | Behavior                                                                             |
| ---------- | -------- | ------------ | ----------------- | ------------------------------------------------------------------------------------ |
| **Base**   | < 640px  | 1            | 24px              | Single column. Full-width cards. Stacked navigation. Tab bar for primary nav.        |
| **sm**     | ≥ 640px  | 1            | 24px              | Minor refinements. Two-column bento grids begin.                                     |
| **md**     | ≥ 768px  | 2            | 48px              | Two-column layouts. Side-by-side splits. Horizontal nav visible. Sidebar as overlay. |
| **lg**     | ≥ 1024px | 3            | 48px              | Three-column grids. Persistent sidebar. Sticky layouts enabled.                      |
| **xl**     | ≥ 1280px | 3            | 96px              | Max-width container reached. Content floats in generous outer margins.               |
| **2xl**    | ≥ 1536px | 3            | 96px              | Wide container for media-heavy layouts only.                                         |

### Grid System

A 12-column CSS Grid governs all multi-column layouts. Never use Flexbox percentage math or `calc()` hacks for column sizing — CSS Grid provides the semantic structure Apple recommends for adaptive layouts.

- **Grid Gutter:** 16px on mobile/tablet, 24px on desktop (≥ 1024px).
- **Asymmetric Splits:** Feature sections use 5/7 or 7/5 column splits — never equal 6/6 halves. This creates the editorial tension Apple uses on every product page.
- **Bento Grids:** Use mixed `col-span` values (e.g., 2+1, 1+2) to create visual hierarchy. The uniform "3 equal cards in a row" pattern is banned.

### Spacing Scale

All vertical and horizontal spacing is derived from the 8px base:

| Token | Value | Usage                                                             |
| ----- | ----- | ----------------------------------------------------------------- |
| `xs`  | 4px   | Micro-adjustments: icon-to-label gaps, badge padding              |
| `sm`  | 8px   | Tight internal spacing: list item padding, input internal gaps    |
| `md`  | 16px  | Standard component gaps: card internals, form field spacing       |
| `lg`  | 24px  | Container padding (mobile), card padding, grouped element spacing |
| `xl`  | 40px  | Section headers to content. Default section-gap.                  |
| `2xl` | 64px  | Major section separation on mobile                                |
| `3xl` | 96px  | Major section separation on desktop                               |
| `4xl` | 128px | Hero section top/bottom padding. Maximum vertical impact.         |

### Section Rhythm

Section spacing scales fluidly with viewport using `clamp()` — the Apple approach of "content breathes on larger screens, compresses on smaller ones":

- **Hero Spacing:** `clamp(64px, 10vw, 128px)` — never cramped, always cinematic.
- **Section Spacing:** `clamp(40px, 8vw, 96px)` — generous but proportional.
- **Component Spacing:** `clamp(16px, 3vw, 24px)` — tight but never touching.

### Full-Height Sections

Hero sections and full-page panels use `min-h-[100dvh]` — never `h-screen`. The `dvh` unit accounts for mobile browser chrome (Safari's collapsing URL bar) and prevents the catastrophic layout jump that `vh` causes on iOS. This directly follows Apple's safe area guidance.

### Touch Targets

All interactive elements maintain a minimum 44×44px touch target, per Apple's Human Interface Guidelines. Buttons at the `xs` size (24px visual height) use invisible padding to meet this threshold. Icon-only buttons at all sizes already meet or exceed 44px. Tap targets for adjacent items must have at least 8px of separation to prevent accidental activation.

### Navigation

- **Desktop (≥ 768px):** Floating pill navbar, centered, max-width 768px, with `backdrop-blur-xl` and `nav-float` shadow on scroll. Height: 48px. The blur material follows Apple's approach of using translucency to maintain spatial context while scrolling.
- **Mobile (< 768px):** Collapses to a clean sheet or slide-over menu. The floating pill shrinks to icon + logo. Following Apple's iOS pattern, consider a bottom tab bar for primary navigation on mobile to keep actions within thumb reach.
- **Sidebar (≥ 1024px):** Fixed width of 256px. Collapses to an icon rail (64px) on medium screens. Hidden entirely on mobile. Sidebar background uses a subtly tinted surface to create visual separation from the content area.

### Line Length

Body text paragraphs are constrained to `max-w-[65ch]` (approximately 650px at 16px). Headlines may extend wider but should never span the full container width at desktop sizes. This prevents the "wall of text" effect and maintains the focused, editorial reading experience Apple uses across its documentation and marketing pages.

## Elevation & Depth

This design system achieves depth through **tonal layering**, **translucent materials**, and **subtle structural borders** — following Apple's approach where elevation is communicated through background tint shifts rather than heavy drop shadows.

### Surface Hierarchy

- **Level 0 (Canvas):** The primary background surface. Equivalent to Apple's `systemBackground`.
- **Level 1 (Cards/Containers):** Same background color with a 1px border in the `border` token. No box-shadow in the default state. Equivalent to Apple's `secondarySystemBackground`.
- **Level 2 (Popovers/Dropdowns):** Elevated with a soft diffused shadow and a 1px border. The shadow uses Zinc-950 at low opacity to avoid dirty gray artifacts. Equivalent to Apple's `tertiarySystemBackground`.

### Materials & Translucency

Following Apple's materials system, floating elements use `backdrop-blur` to maintain spatial context. The floating navbar uses `backdrop-blur-xl` (24px blur radius) with a semi-transparent background to let underlying content show through — this creates the depth-through-translucency effect Apple pioneered with iOS 7 and refined through Liquid Glass.

- **Regular Material:** Background at 80% opacity with 24px blur. Used for floating nav, sidebars when overlaying content.
- **Thick Material:** Background at 90% opacity with 16px blur. Used for popovers, dropdowns, modals where legibility of overlay content takes priority.

### Border Behavior

- **Light Mode:** Solid borders using the `border` token (#E4E4E7). Clean, structural.
- **Dark Mode:** Borders shift to `rgba(255, 255, 255, 0.1)` — translucent white that simulates the glass-like edge definition Apple uses in dark mode interfaces.
- **Focus States:** Input borders are replaced by the ring color on focus, with a 3px ring at 30% opacity. This provides the clear, unambiguous focus indication Apple requires for accessibility.

### Shadow Scale

An 8-tier shadow scale from `sm` (1px offset, barely visible) to `popover` (deep dual-layer). All shadows are tinted with Zinc-950 at low opacity — never pure black, which produces dirty gray artifacts. Specialized variants:

- **`nav-float`:** Ultra-subtle (4% opacity, 30px blur). The floating element barely separates from the background.
- **`button-glow`:** Cobalt-tinted (15% opacity). The primary action button casts a colored glow that reinforces the accent hierarchy.
- **`popover`:** Deep dual-layer shadow (35% + 20% opacity). Creates physical separation for modal-like overlays.

## Shapes

The shape language follows Apple's continuous corner radius ("squircle") approach — generously rounded corners that feel organic and approachable. Each component category uses a consistent radius level to create a predictable visual rhythm.

> The radius scale is the **restrained** identity ratified in
> [`docs/design/luma-2.0-spec.md`](docs/design/luma-2.0-spec.md) §4.5: `sm` 6px · `DEFAULT` 8px ·
> `lg` 10px · `xl` 12px · `2xl` 14px · `3xl` 16px · `4xl` 20px (the ceiling) · `pill` 9999px.
> Controls stay ≤ 8px, cards ≤ 12px, containers ≤ 16px; components use ≤ `rounded-2xl` in practice.

- **Buttons:** guest/marketing buttons are the capsule (`pill`) — the signature interactive element. The ops console keeps the compact `rounded-md` (8px) shadcn control so dense toolbars stay aligned with inputs.
- **Cards:** rounded-xl (0.75rem) — standard containers. Soft enough to feel modern, structured enough to contain dense content.
- **Popovers/Dropdowns:** rounded-DEFAULT (0.5rem) — slightly tighter, communicating precision.
- **Inputs:** rounded-DEFAULT (0.5rem) — matches popovers for visual consistency in form contexts.
- **Badges/Chips:** rounded-full (9999px) — status indicators and tags.
- **Consistency Rule:** Never mix radius profiles within the same component category. Guest buttons are always capsule. Cards are always rounded-xl. Mixing radii creates visual noise that Apple specifically warns against.

## Motion & Interaction

All motion follows Apple's principle: **brief, precise, and purposeful**. Animation exists to provide feedback and maintain spatial orientation — never to decorate. Frequent UI interactions avoid adding motion to prevent fatigue.

### Easing Curves

- **Default (`cubic-bezier(0.25, 0.1, 0.25, 1)`):** Standard curve for hover states, color shifts, and micro-interactions. Smooth and invisible — the user should not notice the animation, only that the state changed.
- **Spring (`cubic-bezier(0.22, 1, 0.36, 1)`):** The signature curve. Used for scroll-triggered reveals, page transitions, and element entrances. Starts fast, decelerates slowly — elements feel like they have physical mass. This mirrors the spring animation system Apple uses in SwiftUI.
- **Bounce (`cubic-bezier(0.34, 1.56, 0.64, 1)`):** Subtle overshoot for playful moments — toast notifications, badge counts, success confirmations. Used sparingly. Per Apple's guidance, avoid bounce for frequent interactions.

### Duration Scale

- **Fast (150ms):** Hover states, focus rings, color transitions. Below the threshold of conscious perception — the change registers but the animation does not.
- **Default (250ms):** Standard interactive transitions — dropdowns, accordions, tab switches. Long enough to track, short enough to never feel slow.
- **Slow (500ms):** Complex layout shifts — sidebar toggling, panel resizing. The longer duration helps users maintain spatial orientation during significant layout changes.
- **Reveal (800ms):** Scroll-triggered content entrances. Elements fade up with 20px translate using spring easing. Stagger children by 100ms for cascade waterfall reveals. This is the only "decorative" animation tier and is used exclusively on initial page load or scroll-into-view.

### Interaction Feedback

Following Apple's direct manipulation principle, every interaction produces immediate visual feedback:

- **Tactile Press:** Buttons scale to `0.98` on active press, combined with 1px translate-y. This creates a physical "click" feel — the button appears to depress into the surface.
- **Hover Lift:** Cards and interactive containers gain `shadow-md` on hover, creating a subtle "lift" effect that signals interactivity.
- **Focus Indication:** All focusable elements display a 3px ring in the ring color at 30% opacity. Focus must be visible in all modes — never removed for aesthetic reasons.

### Reduced Motion

All animations must defer to simple opacity fades (or no animation at all) when `prefers-reduced-motion` is enabled. This is non-negotiable. Scroll-triggered reveals become instant. Stagger delays are removed. Spring easing becomes linear. Only opacity transitions are permitted. This follows Apple's accessibility requirement that all motion-sensitive users can use the interface comfortably.

## Components

### Buttons

The button system follows Apple's button style hierarchy: use style — not size — to distinguish the preferred action. A single prominent (filled) button per view draws attention to the most likely action. Supporting actions use less prominent styles.

Six variants share one shape per surface (capsule on guest, `rounded-md` on ops). Height: 36px (9 × 4px). Padding: 12px horizontal.

- **Primary (filled):** Cobalt blue fill with near-white text. Hover darkens to #1240CF. The `button-glow` shadow adds a colored aura. Limit to one or two per view.
- **Secondary (tinted):** Zinc-100 fill with Zinc-950 text. For supporting actions that need visual weight without competing with primary.
- **Outline (bordered):** White fill with 1px border. For actions that should be present but visually recessive.
- **Ghost (plain):** Transparent until hovered, when Zinc-100 appears. For toolbar actions, navigation items, and dense control rows.
- **Destructive (danger):** 10% red tint fill with full-chroma red text. Per Apple HIG, destructive buttons never use the primary (most prominent) style to prevent accidental invocation.
- **Link (inline):** Cobalt text with underline on hover. For inline text actions.

Size tiers: xs (24px), sm (32px), default (36px), lg (40px), plus icon-only variants. All sizes maintain the 44px minimum touch target through invisible padding.

### Cards

Cards use a white surface with 1px border for edge definition — no box-shadow in the resting state. Internal padding follows the `lg` spacing token (24px). On hover, cards gain `shadow-md` to provide the Apple-style "lift" feedback that signals interactivity. Cards that are not interactive must not exhibit hover changes — visual feedback must accurately represent the element's capability.

### Inputs

Text inputs are 36px tall with rounded-DEFAULT corners and a 1px border. Label placement: above the input, never floating. Error text appears below with the destructive color. On focus, the border shifts to the ring color with a 3px focus ring at 30% opacity. This follows Apple's input field pattern of clear, static labels with prominent focus indication.

### Sidebar

The sidebar uses a subtly tinted surface (#FAFAFA in light, #18181B in dark) following Apple's split-view pattern. Its own primary accent (#155DFC) is slightly brighter than the main primary to ensure active navigation items are legible against the tinted background. Borders and rings within the sidebar use their own token set for visual independence. The sidebar collapses to an icon rail at medium viewports and disappears entirely on mobile, where navigation shifts to a bottom tab bar pattern.

## Do's and Don'ts

### Visual Design

- Do use the cobalt-blue primary for interactive elements only — CTAs, links, active states, focus rings
- Do maintain Zinc hue consistency — never mix warm and cool grays within the same view
- Do use Merriweather exclusively for display and headline tiers; never for body text or labels
- Do provide both light and dark variants for every custom color — dark mode is a redesign, not an inversion
- Don't apply box-shadows to cards in the resting state — use border tokens for edge definition
- Don't use the destructive color for non-error contexts or as a primary button style
- Don't mix rounded profiles within the same component category
- Don't use more than two font weights on a single screen

### Layout & Responsive

- Do use `min-h-[100dvh]` for full-height sections — never `h-screen` (iOS Safari safe area violation)
- Do use `clamp()` for all responsive spacing and typography — never discrete breakpoint jumps
- Do constrain body text to `max-w-[65ch]` — readability degrades beyond 65 characters per line
- Do ensure all interactive elements meet the 44×44px minimum touch target with 8px separation
- Do use CSS Grid for multi-column layouts — never Flexbox percentage math or `calc()` hacks
- Do use asymmetric column splits (5/7, 7/5) — never equal 6/6 halves
- Do scale container padding with viewport: 24px → 48px → 96px
- Don't use uniform "3 equal cards in a row" layouts — use bento grids with mixed column spans
- Don't allow horizontal overflow on mobile — this is a critical failure

### Motion & Accessibility

- Do respect `prefers-reduced-motion` — defer all animation to opacity fades or remove entirely
- Do provide visible focus indicators on every interactive element — never remove for aesthetics
- Do use color-independent indicators for all semantic states (error icon + text, not just red)
- Do use brief, precise animations for feedback — avoid decorative motion on frequent interactions
- Do scale to at least 200% text size without layout breakage (WCAG 1.4.4)
- Do maintain WCAG AA contrast ratios (4.5:1 normal text, 3:1 large text) in both light and dark modes
- Don't use translucent borders in light mode — reserve `rgba(255, 255, 255, 0.1)` for dark mode only
- Don't auto-play animations, trap scroll, or override native browser behaviors
- Don't rely solely on color to communicate state — always pair with shape, icon, or text

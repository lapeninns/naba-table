# SajiloReserveX Guest-Facing Style Guide

> **Implementation-ready visual system for guest-facing pages**  
> _Extracted from: `globals.css`, `tokens.css`, `tailwind.config.js`, and component sources_  
> _Last Updated: 2025-12-06 | Verified Consistent: ✅_

---

## 1. Summary

The **SajiloReserveX / "Nab a Table"** guest experience embodies a **modern, calm, and premium hospitality** aesthetic. The visual language communicates:

- **Trust & Reliability**: Clean whites, subtle blue accents, and professional typography create confidence in the booking process
- **Warmth & Approachability**: Soft gradients, rounded corners (up to 32px), and gentle animations invite engagement without intimidation
- **Visual Airiness**: Generous spacing (8pt grid), minimal visual clutter, and muted shadows maintain breathing room throughout
- **Consistency**: The `.guest-theme` wrapper applies a cohesive blue-tinted palette across all guest routes, differentiating from the dark-themed restaurant operations dashboard
- **Accessibility First**: 44px minimum touch targets, visible focus rings, reduced-motion support, and WCAG-compliant contrast ratios

The overall density is **airy** with a **high level of polish** — cards float with layered shadows, buttons feature subtle hover lifts, and page backgrounds incorporate ethereal gradient orbs for depth.

---

## 2. Typography

### 2.1 Font Families

| Font Stack                                                                           | Token           | Usage                                      |
| :----------------------------------------------------------------------------------- | :-------------- | :----------------------------------------- |
| `'Nab a Table Cereal App', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif` | `--font-sajilo` | All text (headings, body, buttons, labels) |

**Configuration:**

```css
:root {
  --font-sajilo: 'Nab a Table Cereal App', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
}
```

```javascript
// tailwind.config.js
fontFamily: {
  sans: ["var(--font-sajilo)", ...fontFamily.sans],
}
```

### 2.2 Type Scale & Roles

| Role                | Token                  | Size (rem/px)   | Weight  | Line Height                    | Letter Spacing     |
| :------------------ | :--------------------- | :-------------- | :------ | :----------------------------- | :----------------- |
| **Hero**            | `--guest-text-hero`    | 2.5rem (40px)   | 700     | `--guest-leading-tight` (1.2)  | -0.025em           |
| **Hero (lg)**       | `--guest-text-hero-lg` | 3rem (48px)     | 700     | `--guest-leading-tight` (1.2)  | -0.025em           |
| **Page Title**      | `--guest-text-page`    | 2rem (32px)     | 700     | `--guest-leading-tight` (1.2)  | -0.02em            |
| **Section Heading** | `--guest-text-section` | 1.5rem (24px)   | 600     | `--guest-leading-snug` (1.35)  | -0.015em           |
| **Card Title**      | `--guest-text-card`    | 1.125rem (18px) | 600     | `--guest-leading-snug` (1.35)  | normal             |
| **Body**            | `--guest-text-body`    | 1rem (16px)     | 400     | `--guest-leading-normal` (1.5) | normal             |
| **Caption**         | `--guest-text-caption` | 0.875rem (14px) | 400     | `--guest-leading-normal` (1.5) | normal             |
| **Micro/Badge**     | `--guest-text-micro`   | 0.75rem (12px)  | 500–600 | `--guest-leading-normal` (1.5) | normal             |
| **Eyebrow**         | `.guest-eyebrow`       | 0.75rem (12px)  | 600     | normal                         | 0.08em (uppercase) |

### 2.3 Line Height Tokens

```css
.guest-theme {
  --guest-leading-tight: 1.2; /* Headlines */
  --guest-leading-snug: 1.35; /* Section/card titles */
  --guest-leading-normal: 1.5; /* Body text */
  --guest-leading-relaxed: 1.65; /* Long-form reading */
}
```

### 2.4 Typographic Patterns

**Hierarchy Creation:**

- **Size** is the primary differentiator (40px → 32px → 24px → 18px → 16px → 14px → 12px)
- **Weight** reinforces: headings use `600–700`, body uses `400`
- **Tracking** tightens on headings (`-0.02em` on page titles, `-0.025em` on hero)
- **Color** differentiates: headings use `text-slate-900`, body uses `text-slate-600/500`

**Stylistic Choices:**

- `font-feature-settings: 'cv02', 'cv03', 'cv04', 'cv11';` on body for refined character variants
- `font-variant-numeric: tabular-nums;` for consistent numeric alignment
- `text-wrap: pretty;` on paragraphs for improved line breaks

**Utility Classes:**

```css
.guest-heading-hero {
  font-size: var(--guest-text-hero);
  font-weight: 700;
  line-height: var(--guest-leading-tight);
  letter-spacing: -0.025em;
}
.guest-heading-page {
  font-size: var(--guest-text-page);
  font-weight: 700;
  line-height: var(--guest-leading-tight);
  letter-spacing: -0.02em;
}
.guest-heading-section {
  font-size: var(--guest-text-section);
  font-weight: 600;
  line-height: var(--guest-leading-snug);
  letter-spacing: -0.015em;
}
.guest-heading-card {
  font-size: var(--guest-text-card);
  font-weight: 600;
  line-height: var(--guest-leading-snug);
}
.guest-body {
  font-size: var(--guest-text-body);
  line-height: var(--guest-leading-normal);
}
.guest-caption {
  font-size: var(--guest-text-caption);
  line-height: var(--guest-leading-normal);
}
.guest-micro {
  font-size: var(--guest-text-micro);
  line-height: var(--guest-leading-normal);
  font-weight: 500;
}
```

---

## 3. Color & Look

### 3.1 Guest Theme Color Tokens (`.guest-theme`)

| Role                     | Token                    | HSL Value       | Hex Equivalent        | Usage                              |
| :----------------------- | :----------------------- | :-------------- | :-------------------- | :--------------------------------- |
| **Primary**              | `--primary`              | `217 91% 60%`   | `#3B82F6` (blue-500)  | Buttons, links, CTAs, focus rings  |
| **Primary Foreground**   | `--primary-foreground`   | `210 40% 98%`   | `#F8FAFC`             | Text on primary buttons            |
| **Secondary**            | `--secondary`            | `213 96% 93%`   | `#DBEAFE` (blue-100)  | Secondary button backgrounds       |
| **Secondary Foreground** | `--secondary-foreground` | `222 47% 11%`   | `#1E293B`             | Text on secondary surfaces         |
| **Accent**               | `--accent`               | `213 100% 96%`  | `#EFF6FF` (blue-50)   | Highlight backgrounds, badges      |
| **Accent Foreground**    | `--accent-foreground`    | `222 47% 11%`   | `#1E293B`             | Text on accent surfaces            |
| **Muted**                | `--muted`                | `213 100% 96%`  | `#EFF6FF`             | Subtle backgrounds                 |
| **Muted Foreground**     | `--muted-foreground`     | `215 18% 45%`   | `#64748B` (slate-500) | Secondary text, captions           |
| **Border**               | `--border`               | `216 33% 90%`   | `#E2E8F0`             | Card borders, dividers             |
| **Input**                | `--input`                | `216 33% 90%`   | `#E2E8F0`             | Input field borders                |
| **Ring**                 | `--ring`                 | `217 91% 60%`   | `#3B82F6`             | Focus outlines                     |
| **Info**                 | `--info`                 | `217 91% 60%`   | `#3B82F6`             | Info status indicators             |
| **Success**              | `--success`              | `142 76% 36%`   | `#16A34A` (green-600) | Success states                     |
| **Warning**              | `--warning`              | `38 92% 50%`    | `#F59E0B` (amber-500) | Warning states                     |
| **Destructive**          | `--destructive`          | `0 84.2% 60.2%` | `#EF4444` (red-500)   | Error, cancel, destructive actions |

### 3.2 Semantic Color Aliases

```css
/* From tokens.css */
--sr-color-background: var(--color-background);
--sr-color-surface: var(--color-surface);
--sr-color-primary: var(--color-primary);
--sr-color-text-primary: var(--color-text-primary);
--sr-color-text-secondary: var(--color-text-secondary);
```

### 3.3 Legacy Tokens (Still Referenced)

```css
/* Airbnb DLS Bridge Tokens */
--dls-color-brand-primary: #ff385c; /* Not used in guest theme */
--dls-color-brand-accent: #008489; /* Not used in guest theme */
--dls-color-text-primary: #222222;
--dls-color-text-secondary: #717171;
--dls-color-functional-success: #008489;

/* SRX Legacy Tokens */
--srx-surface-positive: #e8f3ff;
--srx-surface-info: #e7f2ff;
--srx-surface-warn: #fdebc8;
--srx-border-subtle: rgba(15, 23, 42, 0.08);
--srx-ink-strong: #111827;
--srx-easing-standard: cubic-bezier(0.22, 1, 0.36, 1);
```

### 3.4 Color Usage Patterns

| Element              | Background                    | Border                           | Text                            |
| :------------------- | :---------------------------- | :------------------------------- | :------------------------------ |
| **Page**             | `white` / `slate-50` gradient | —                                | `slate-900`                     |
| **Card**             | `white`                       | `slate-100` / `blue-100`         | `slate-900` / `slate-600`       |
| **Primary Button**   | `blue-500` gradient           | —                                | `white`                         |
| **Secondary Button** | `white`                       | `slate-200` / `blue-200`         | `slate-900` / `blue-800`        |
| **Badge (info)**     | `blue-50`                     | —                                | `blue-700`                      |
| **Badge (success)**  | `emerald-50`                  | —                                | `emerald-900`                   |
| **Input**            | `white`                       | `slate-200` → `blue-500` (focus) | `slate-900`                     |
| **Link**             | —                             | —                                | `blue-600` → `blue-800` (hover) |

### 3.5 Status Color Utility Classes

```css
.guest-status-info {
  background: hsl(213 100% 96%);
  color: hsl(217 91% 40%);
}
.guest-status-success {
  background: hsl(143 85% 96%);
  color: hsl(142 76% 30%);
}
.guest-status-warning {
  background: hsl(48 100% 96%);
  color: hsl(32 95% 35%);
}
.guest-status-error {
  background: hsl(0 100% 97%);
  color: hsl(0 72% 45%);
}
```

### 3.6 Mood & Accessibility

- **Mood**: Hospitable, premium, calm blue-tinted palette
- **Contrast**: All text meets WCAG AA (4.5:1 for normal text, 3:1 for large text)
- **Primary Application**: Blue (#3B82F6) is used for interactive elements only; not overused to maintain visual hierarchy

### 3.7 Consolidated Semantic Token Set (Proposed)

```css
:root {
  /* Guest-facing semantic tokens */
  --guest-color-bg-page: hsl(0 0% 100%);
  --guest-color-bg-surface: hsl(var(--card));
  --guest-color-bg-accent: hsl(213 100% 96%);
  --guest-color-bg-muted: hsl(210 40% 98%);

  --guest-color-text-primary: hsl(222 47% 11%);
  --guest-color-text-secondary: hsl(215 16% 47%);
  --guest-color-text-muted: hsl(215 18% 45%);
  --guest-color-text-inverse: hsl(210 40% 98%);

  --guest-color-primary: hsl(217 91% 60%);
  --guest-color-primary-hover: hsl(220 83% 53%);
  --guest-color-primary-soft: hsl(213 96% 93%);

  --guest-color-border-default: hsl(214 32% 91%);
  --guest-color-border-subtle: hsl(216 33% 90%);
  --guest-color-border-emphasis: hsl(217 91% 60%);

  --guest-color-ring: hsl(217 91% 60%);
  --guest-color-success: hsl(142 76% 36%);
  --guest-color-warning: hsl(38 92% 50%);
  --guest-color-danger: hsl(0 84.2% 60.2%);
}
```

---

## 4. Motion & Interaction

### 4.1 Keyframe Animations

| Animation      | Keyframe     | Applied To                       | Duration / Easing                        |
| :------------- | :----------- | :------------------------------- | :--------------------------------------- |
| **Fade In**    | `fade-in`    | General entry transitions        | `0.2s ease-out`                          |
| **Fade Up**    | `fade-up`    | Cards, sections, staggered items | `0.3s ease-out`                          |
| **Fade Down**  | `fade-down`  | Dropdowns, overlays              | `0.3s ease-out`                          |
| **Scale In**   | `scale-in`   | Modals, popovers                 | `0.2s ease-out`                          |
| **Slide Up**   | `slide-up`   | Bottom sheets, wizard nav        | `0.3s ease-out`                          |
| **Slide Down** | `slide-down` | Notifications                    | `0.3s ease-out`                          |
| **Shimmer**    | `shimmer`    | Loading skeletons                | `2s ease-in-out infinite`                |
| **Celebrate**  | `celebrate`  | Success confirmations            | `0.6s cubic-bezier(0.34, 1.56, 0.64, 1)` |
| **Shake**      | `shake`      | Error feedback                   | `0.5s ease-in-out`                       |
| **Wiggle**     | `wiggle`     | Attention-grabbing elements      | `1.5s ease-in-out infinite`              |
| **Popup**      | `popup`      | Badges, tooltips                 | `0.25s ease-in-out`                      |

### 4.2 Guest Transition Tokens

```css
.guest-theme {
  --guest-transition-fast: 150ms ease-out;
  --guest-transition-base: 200ms ease-out;
  --guest-transition-slow: 300ms ease-out;
  --guest-transition-transform: transform 200ms cubic-bezier(0.22, 1, 0.36, 1);
}
```

### 4.3 Interactive State Tokens

```css
.guest-theme {
  --guest-hover-lift: -2px;
  --guest-hover-scale: 1.02;
  --guest-active-scale: 0.98;
}
```

### 4.4 Component-Specific Interactions

| Element                | Hover State                                                      | Active State                      |
| :--------------------- | :--------------------------------------------------------------- | :-------------------------------- |
| **Primary Button**     | `translateY(-1px)`, `shadow-md → shadow-lg`, `scale(1.02)`       | `scale(0.98)`                     |
| **Card**               | `translateY(-2px)`, `shadow-sm → shadow-md`                      | —                                 |
| **Card (interactive)** | `translateY(-2px)`, `shadow-md → shadow-lg`, border color change | `scale(0.98)`                     |
| **Link**               | Text color darkens, underline (if applicable)                    | —                                 |
| **Input**              | Border color lightens                                            | Border → primary color, glow ring |

### 4.5 Reduced Motion Support

```css
@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### 4.6 Stagger Animation Helper

```css
.guest-stagger > * {
  animation: fade-up 0.3s ease-out backwards;
}
.guest-stagger > *:nth-child(1) {
  animation-delay: 0ms;
}
.guest-stagger > *:nth-child(2) {
  animation-delay: 50ms;
}
.guest-stagger > *:nth-child(3) {
  animation-delay: 100ms;
}
.guest-stagger > *:nth-child(4) {
  animation-delay: 150ms;
}
.guest-stagger > *:nth-child(5) {
  animation-delay: 200ms;
}
.guest-stagger > *:nth-child(6) {
  animation-delay: 250ms;
}
```

---

## 5. Background & Surfaces

### 5.1 Page Background (Layout-Level Only)

> **Important**: Background gradients are applied **only at the layout level** (`MarketingLayout`, `GuestLayout`, `AuthLayout`). Individual pages should **not** define their own background gradients.

All guest layouts use a shared background pattern:

**Base Gradient (in layouts):**

```jsx
<div className="guest-theme relative min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 text-foreground">
```

**Decorative Gradient Orbs:**

| Position  | Size      | Gradient                                                               | Opacity |
| :-------- | :-------- | :--------------------------------------------------------------------- | :------ |
| Top-left  | 500×500px | `radial-gradient(circle, hsl(217 91% 60% / 0.15) 0%, transparent 70%)` | 40%     |
| Top-right | 400×400px | `radial-gradient(circle, hsl(38 92% 50% / 0.12) 0%, transparent 70%)`  | 30%     |
| Bottom    | 600×600px | `radial-gradient(circle, hsl(217 91% 60% / 0.12) 0%, transparent 70%)` | 25%     |

**Subtle Grid Pattern:**

```jsx
<div
  className="absolute inset-0 opacity-[0.02]"
  style={{
    backgroundImage: `url("data:image/svg+xml,...")`, // Cross pattern SVG
  }}
/>
```

### 5.2 Surface Styles

| Component             | Background                                                 | Border                 | Shadow                            | Radius                         |
| :-------------------- | :--------------------------------------------------------- | :--------------------- | :-------------------------------- | :----------------------------- |
| **GuestSection**      | `white`                                                    | `1px solid slate-100`  | `shadow-sm` → `shadow-md` (hover) | `rounded-2xl` (24px)           |
| **GuestHero**         | `gradient-to-br from-blue-50 via-white to-blue-100/40`     | `1px solid blue-100`   | `shadow-lg`                       | `rounded-2xl` (24px)           |
| **GuestCard**         | `white`                                                    | `1px solid slate-100`  | `shadow-sm` → `shadow-md` (hover) | `rounded-xl` (16px)            |
| **GuestEmpty**        | `gradient-to-b from-slate-50/80 to-white`                  | `2px dashed slate-200` | —                                 | `rounded-2xl` (24px)           |
| **GuestStatus**       | Tone-based (`blue-50`, `emerald-50`, `amber-50`, `red-50`) | `transparent`          | —                                 | `rounded-xl` (16px)            |
| **Wizard Step**       | `bg-card` (white)                                          | `1px solid border/50`  | `shadow-lg shadow-black/5`        | `rounded-xl sm:rounded-2xl`    |
| **Wizard Navigation** | `white/90 backdrop-blur-xl`                                | `1px solid white/40`   | `shadow-2xl shadow-black/15`      | `rounded-t-3xl sm:rounded-3xl` |

### 5.3 Shadow Scale

```css
.guest-theme {
  --guest-shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.04);
  --guest-shadow-sm: 0 2px 4px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04);
  --guest-shadow-md: 0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.04);
  --guest-shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.1), 0 4px 8px rgba(0, 0, 0, 0.06);
  --guest-shadow-xl: 0 16px 48px rgba(0, 0, 0, 0.12), 0 8px 16px rgba(0, 0, 0, 0.08);
  --guest-shadow-glow: 0 0 24px rgba(59, 130, 246, 0.25);
}
```

### 5.4 Glassmorphism Pattern

Used in `WizardNavigation` and navbar:

```css
.guest-glass {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

/* Enhanced version */
.bg-white/90.backdrop-blur-xl.supports-[backdrop-filter]: bg-white/80;
```

---

## 6. Layout & Spacing System

### 6.1 Spacing Scale (8pt Grid)

```css
.guest-theme {
  --guest-space-xs: 0.5rem; /* 8px  - tight gaps */
  --guest-space-sm: 0.75rem; /* 12px - small gaps */
  --guest-space-md: 1rem; /* 16px - default gaps */
  --guest-space-lg: 1.5rem; /* 24px - section padding, card padding */
  --guest-space-xl: 2rem; /* 32px - larger section gaps */
  --guest-space-2xl: 2.5rem; /* 40px - page section spacing */
  --guest-space-3xl: 3rem; /* 48px - major section dividers */
}
```

### 6.2 Container & Section Tokens

```css
.guest-theme {
  --guest-section-gap: 2.5rem; /* 40px - between major sections */
  --guest-section-padding-x: 1.5rem; /* 24px - horizontal page padding */
  --guest-section-padding-y: 2rem; /* 32px - vertical section padding */
  --guest-card-padding: 1.5rem; /* 24px - inside cards */
  --guest-content-gap: 1.5rem; /* 24px - between cards/content items */
}
```

### 6.3 Page Container Pattern

```css
.guest-page {
  max-width: 72rem; /* 1152px = max-w-6xl (REQUIRED) */
  margin-inline: auto;
  padding-inline: var(--guest-section-padding-x); /* 24px */
  padding-block: var(--guest-section-gap); /* 40px */
}

/* All guest pages MUST use max-w-6xl for consistency */

@media (min-width: 640px) {
  .guest-page {
    padding-inline: var(--guest-space-xl);
  }
} /* 32px */
@media (min-width: 1024px) {
  .guest-page {
    padding-inline: var(--guest-space-2xl);
  }
} /* 40px */
```

### 6.4 Border Radius Scale

```css
.guest-theme {
  --guest-radius-sm: 0.5rem; /* 8px - buttons, badges, inputs */
  --guest-radius-md: 0.75rem; /* 12px - small cards, modals */
  --guest-radius-lg: 1rem; /* 16px - cards */
  --guest-radius-xl: 1.5rem; /* 24px - large cards, sections */
  --guest-radius-2xl: 2rem; /* 32px - hero sections */
  --guest-radius-full: 9999px; /* pills, avatars, CTAs */
}
```

### 6.5 Responsive Breakpoints

| Breakpoint | Width  | Common Changes                                         |
| :--------- | :----- | :----------------------------------------------------- |
| **sm**     | 640px  | Stack → inline layouts, increased padding              |
| **md**     | 768px  | Desktop navigation appears, tablet optimizations       |
| **lg**     | 1024px | Multi-column grids (lg:grid-cols-3), larger typography |
| **xl**     | 1280px | Max container width, refined spacing                   |

### 6.6 Key Component Patterns

| Component            | Location                   | Key Visual Treatments                                                                |
| :------------------- | :------------------------- | :----------------------------------------------------------------------------------- |
| **GuestNavbar**      | `GuestNavbar.tsx`          | Sticky, `backdrop-blur`, `bg-white/90`, rounded-full nav items, skip-to-content link |
| **GuestHero**        | `GuestPrimitives.tsx`      | Gradient orbs, centered text, badge (eyebrow), pill CTAs                             |
| **GuestSection**     | `GuestPrimitives.tsx`      | White card, subtle border, optional eyebrow badge, header/actions/content            |
| **GuestCard**        | `GuestPrimitives.tsx`      | `rounded-xl`, header/content/footer slots, hover shadow elevation                    |
| **GuestStatus**      | `GuestPrimitives.tsx`      | Tone-based (info/success/warning/error), `rounded-xl`, icon + text                   |
| **GuestEmpty**       | `GuestPrimitives.tsx`      | Dashed border, gradient bg, centered icon, CTA button                                |
| **Booking Wizard**   | `/restaurants/[slug]/book` | Multi-step, floating sticky footer (glassmorphism), progress indicator               |
| **WizardStep**       | `WizardStep.tsx`           | Card with header/content, icon in primary-tinted circle, focus management            |
| **WizardNavigation** | `WizardNavigation.tsx`     | Fixed bottom, safe-area-aware, pill buttons, progress bar                            |

---

## 7. Accessibility Baseline

### 7.1 Focus Management

```css
:focus-visible {
  outline: 2px solid hsl(var(--ring));
  outline-offset: 2px;
}

.guest-focus:focus-visible {
  outline-color: hsl(var(--ring));
}
```

### 7.2 Touch Targets

All interactive elements meet the 44×44px minimum:

```css
button,
[role='button'],
input[type='checkbox'],
input[type='radio'] {
  min-width: 44px;
  min-height: 44px;
}
```

Buttons in `WizardNavigation`:

```css
/* 44px on mobile, 48px on desktop */
.h-11.rounded-full.sm: h-12;
```

### 7.3 Skip Link

```css
.skip-link {
  position: fixed;
  left: 1rem;
  top: 1rem;
  z-index: 9999;
  transform: translateY(-160%);
  /* ... styling ... */
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

.skip-link:focus-visible {
  transform: translateY(0);
}
```

### 7.4 Input Zoom Prevention

```css
input,
textarea,
select {
  font-size: 16px; /* Prevents iOS zoom */
}
```

### 7.5 Screen Reader Support

- `aria-live="polite"` on status messages and toasts
- `role="status"` on `GuestStatus` component
- `aria-labelledby` on wizard steps linking to title
- `.sr-only` class for screen-reader-only content
- `aria-hidden="true"` on decorative icons

### 7.6 Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 8. Component Quick Reference

### 8.1 Button Variants

> **Rule**: Primary and secondary CTAs use `rounded-full`. Tertiary/ghost buttons may use `rounded-xl` for de-emphasized actions.

| Variant               | Background                     | Border             | Text             | Radius                    | Shadow      |
| :-------------------- | :----------------------------- | :----------------- | :--------------- | :------------------------ | :---------- |
| **Primary CTA**       | `bg-slate-900` / `bg-blue-500` | —                  | white            | `rounded-full` ✅         | `shadow-lg` |
| **Secondary/Outline** | `bg-white`                     | `border-slate-200` | `text-slate-900` | `rounded-full` ✅         | `shadow-sm` |
| **Tertiary/Ghost**    | transparent                    | —                  | `text-slate-600` | `rounded-xl` (acceptable) | —           |
| **Destructive**       | `bg-red-500`                   | —                  | white            | `rounded-full` ✅         | `shadow-lg` |

### 8.2 Badge Variants

```jsx
// Info badge (default guest)
<Badge className="guest-badge" /> // blue-50 bg, blue-700 text

// Status badges
<Badge className="bg-emerald-50 text-emerald-700" />
<Badge className="bg-amber-50 text-amber-700" />
<Badge className="bg-red-50 text-red-700" />
```

### 8.3 Icon Box Pattern

```css
.guest-icon-box {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: var(--guest-radius-md);
  background: hsl(213 100% 96%); /* blue-50 */
  color: hsl(217 91% 40%); /* blue-700 */
}

.guest-icon-box-lg {
  width: 3rem;
  height: 3rem;
  border-radius: var(--guest-radius-lg);
}
```

### 8.4 Input Pattern

```css
.guest-input {
  height: 3rem;
  padding-inline: 1rem;
  border-radius: var(--guest-radius-md);
  border: 1px solid hsl(214 32% 91%);
  background: white;
  font-size: var(--guest-text-body);
  transition:
    border-color var(--guest-transition-fast),
    box-shadow var(--guest-transition-fast);
}

.guest-input:hover {
  border-color: hsl(214 32% 85%);
}
.guest-input:focus {
  border-color: hsl(217 91% 60%);
  box-shadow: 0 0 0 3px hsl(217 91% 60% / 0.1);
  outline: none;
}

.guest-input-with-icon {
  padding-left: 3rem;
}
```

---

## 9. Implementation Checklist

### Before Building a Guest-Facing Page:

- [ ] Wrap content in `.guest-theme` class (via layout)
- [ ] Use `guest-page` and `guest-sections` utility classes
- [ ] Apply 8pt grid spacing tokens
- [ ] Use semantic heading hierarchy (h1 → h2 → h3)
- [ ] Ensure all interactive elements have 44px touch targets
- [ ] Add focus-visible rings to interactive elements
- [ ] Test with reduced-motion preference enabled
- [ ] Verify contrast ratios meet WCAG AA

### Component Selection:

- [ ] Use `GuestSection` for main content blocks
- [ ] Use `GuestHero` for hero/CTA sections
- [ ] Use `GuestCard` for content cards
- [ ] Use `GuestStatus` for inline status messages
- [ ] Use `GuestEmpty` for empty states
- [ ] Use pill-shaped buttons (`rounded-full`) for CTAs

---

_Generated: 2025-12-06 | Last Verified: 2025-12-06T12:45Z | Source: SajiloReserveX codebase analysis_

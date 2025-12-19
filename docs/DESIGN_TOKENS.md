# Design Tokens Reference

> **Nab a Table Design System v2.0**
>
> This document provides a quick reference for all design tokens available in the system.
> All tokens are defined in CSS custom properties and mapped to Tailwind utilities.

---

## Table of Contents

1. [Color System](#color-system)
2. [Typography](#typography)
3. [Spacing](#spacing)
4. [Border Radius](#border-radius)
5. [Shadows](#shadows)
6. [Animations](#animations)
7. [Theme Usage](#theme-usage)

---

## Color System

### Semantic Colors

| Token          | Tailwind Class    | Light Mode         | Dark Mode          | Usage              |
| :------------- | :---------------- | :----------------- | :----------------- | :----------------- |
| `--background` | `bg-background`   | `#ffffff`          | `hsl(222 47% 11%)` | Page backgrounds   |
| `--foreground` | `text-foreground` | `hsl(222 47% 11%)` | `hsl(210 40% 98%)` | Primary text       |
| `--card`       | `bg-card`         | `#ffffff`          | `hsl(222 40% 13%)` | Card backgrounds   |
| `--primary`    | `bg-primary`      | `hsl(222 47% 11%)` | `hsl(210 40% 98%)` | Primary actions    |
| `--secondary`  | `bg-secondary`    | `hsl(210 40% 96%)` | `hsl(217 33% 17%)` | Secondary elements |
| `--muted`      | `bg-muted`        | `hsl(210 40% 96%)` | `hsl(217 33% 17%)` | Muted backgrounds  |
| `--accent`     | `bg-accent`       | `hsl(210 40% 96%)` | `hsl(217 33% 17%)` | Accent highlights  |
| `--border`     | `border-border`   | `hsl(214 32% 91%)` | `hsl(217 33% 17%)` | Borders            |

### Guest Theme Colors (Blue/Coral)

Applied via `data-theme="guest"` on the `<html>` element.

| Token       | Tailwind Class | Value                       | Usage                  |
| :---------- | :------------- | :-------------------------- | :--------------------- |
| `--primary` | `bg-primary`   | `hsl(217 91% 60%)` Blue 500 | Primary buttons, links |
| `--accent`  | `bg-accent`    | `hsl(0 100% 71%)` Coral 500 | CTAs, highlights       |
| `--ring`    | `ring-ring`    | `hsl(217 91% 60%)`          | Focus rings            |
| `--info`    | `bg-info`      | `hsl(217 91% 60%)`          | Info states            |

### Status Colors

| Token           | Tailwind Class   | Value              | Usage                |
| :-------------- | :--------------- | :----------------- | :------------------- |
| `--destructive` | `bg-destructive` | `hsl(0 84% 60%)`   | Error/delete actions |
| `--success`     | `bg-success`     | `hsl(142 76% 36%)` | Success states       |
| `--warning`     | `bg-warning`     | `hsl(38 92% 50%)`  | Warning states       |
| `--info`        | `bg-info`        | `hsl(199 89% 48%)` | Info states          |

### Alpha Support

All colors support Tailwind's opacity modifier:

```tsx
// 50% opacity
<div className="bg-primary/50" />

// 80% opacity text
<span className="text-muted-foreground/80" />
```

---

## Typography

### Guest Typography Scale (Fluid)

| Token                  | Tailwind Class       | Size                                   | Weight | Line Height |
| :--------------------- | :------------------- | :------------------------------------- | :----- | :---------- |
| `--guest-text-hero`    | `text-guest-hero`    | `clamp(2rem, 5vw + 1rem, 3rem)`        | 700    | 1.1         |
| `--guest-text-hero-lg` | `text-guest-hero-lg` | `clamp(2.5rem, 6vw + 1rem, 4rem)`      | 700    | 1.1         |
| `--guest-text-page`    | `text-guest-page`    | `clamp(1.5rem, 3vw + 1rem, 2rem)`      | 700    | 1.1         |
| `--guest-text-section` | `text-guest-section` | `clamp(1.25rem, 2vw + 0.5rem, 1.5rem)` | 600    | 1.35        |
| `--guest-text-card`    | `text-guest-card`    | `1.125rem` (18px)                      | 600    | 1.35        |
| `--guest-text-body`    | `text-guest-body`    | `1rem` (16px)                          | 400    | 1.5         |
| `--guest-text-caption` | `text-guest-caption` | `0.875rem` (14px)                      | 400    | 1.5         |
| `--guest-text-micro`   | `text-guest-micro`   | `0.75rem` (12px)                       | 500    | 1.5         |

### App Typography Scale (Fixed)

| Tailwind Class        | Size | Weight | Usage           |
| :-------------------- | :--- | :----- | :-------------- |
| `text-screen-title`   | 34px | 700    | Screen titles   |
| `text-section-header` | 22px | 600    | Section headers |
| `text-card-title`     | 18px | 600    | Card titles     |
| `text-body`           | 16px | 400    | Body text       |
| `text-label`          | 14px | 400    | Labels          |
| `text-button`         | 16px | 600    | Button text     |

---

## Spacing

### Guest Spacing Scale

| Token               | Tailwind Class | Value            |
| :------------------ | :------------- | :--------------- |
| `--guest-space-xs`  | `p-guest-xs`   | `0.5rem` (8px)   |
| `--guest-space-sm`  | `p-guest-sm`   | `0.75rem` (12px) |
| `--guest-space-md`  | `p-guest-md`   | `1rem` (16px)    |
| `--guest-space-lg`  | `p-guest-lg`   | `1.5rem` (24px)  |
| `--guest-space-xl`  | `p-guest-xl`   | `2rem` (32px)    |
| `--guest-space-2xl` | `p-guest-2xl`  | `2.5rem` (40px)  |
| `--guest-space-3xl` | `p-guest-3xl`  | `3rem` (48px)    |

### Safe Areas

| Tailwind Class | Value                                        | Usage             |
| :------------- | :------------------------------------------- | :---------------- |
| `pb-safe-b`    | `calc(env(safe-area-inset-bottom) + 1.5rem)` | Bottom navigation |
| `pt-safe-t`    | `env(safe-area-inset-top)`                   | Top safe area     |

---

## Border Radius

| Token                 | Tailwind Class       | Value   |
| :-------------------- | :------------------- | :------ |
| `--radius-sm`         | `rounded-sm`         | 8px     |
| `--radius`            | `rounded`            | 12px    |
| `--radius-lg`         | `rounded-lg`         | 16px    |
| `--radius-pill`       | `rounded-pill`       | 9999px  |
| `--guest-radius-sm`   | `rounded-guest-sm`   | 0.5rem  |
| `--guest-radius-md`   | `rounded-guest-md`   | 0.75rem |
| `--guest-radius-lg`   | `rounded-guest-lg`   | 1rem    |
| `--guest-radius-xl`   | `rounded-guest-xl`   | 1.5rem  |
| `--guest-radius-full` | `rounded-guest-full` | 9999px  |

---

## Shadows

### Base Shadows

| Token         | Tailwind Class | Usage             |
| :------------ | :------------- | :---------------- |
| `--shadow-sm` | `shadow-sm`    | Subtle elevation  |
| `--shadow`    | `shadow`       | Default cards     |
| `--shadow-md` | `shadow-md`    | Hover states      |
| `--shadow-lg` | `shadow-lg`    | Modals            |
| `--shadow-xl` | `shadow-xl`    | Floating elements |

### Guest Shadows

| Token                 | Tailwind Class      | Usage           |
| :-------------------- | :------------------ | :-------------- |
| `--guest-shadow-xs`   | `shadow-guest-xs`   | Minimal lift    |
| `--guest-shadow-sm`   | `shadow-guest-sm`   | Cards at rest   |
| `--guest-shadow-md`   | `shadow-guest-md`   | Hover states    |
| `--guest-shadow-lg`   | `shadow-guest-lg`   | Prominent cards |
| `--guest-shadow-glow` | `shadow-guest-glow` | CTA glow effect |

---

## Animations

All animations respect `prefers-reduced-motion`.

| Tailwind Class       | Duration      | Use Case                    |
| :------------------- | :------------ | :-------------------------- |
| `animate-fade-in`    | 200ms         | Instant reveals             |
| `animate-fade-up`    | 300ms         | **Primary entry animation** |
| `animate-fade-down`  | 300ms         | Dropdown menus              |
| `animate-scale-in`   | 200ms         | Modals, popovers            |
| `animate-slide-up`   | 300ms         | Bottom sheets               |
| `animate-slide-down` | 300ms         | Top notifications           |
| `animate-pulse-glow` | 2s infinite   | CTA attention               |
| `animate-shimmer`    | 2s infinite   | Loading states              |
| `animate-wiggle`     | 1.5s infinite | Playful attention           |
| `animate-celebrate`  | 600ms         | Success celebrations        |
| `animate-shake`      | 500ms         | Error feedback              |

### Performance Note

All animations use only `transform` and `opacity` properties for GPU acceleration.
No layout-triggering properties (`width`, `height`, `margin`, `padding`).

---

## Theme Usage

### Setting Theme

The theme is controlled via `data-theme` attribute on the `<html>` element.

```tsx
// Guest theme (marketing, booking)
<html data-theme="guest">

// App theme (dashboard, admin)
<html data-theme="app">
```

### ThemeProvider Component

```tsx
import { ThemeProvider } from '@/components/providers/ThemeProvider';

// In layout
<ThemeProvider theme="guest">{children}</ThemeProvider>;
```

### JavaScript Theme Toggle

```ts
import { useTheme } from '@/components/providers/ThemeProvider';

const { setTheme, getTheme } = useTheme();

// Set theme
setTheme('guest');

// Get current theme
const current = getTheme(); // 'guest' | 'app'
```

### Dark Mode

Dark mode uses the `.dark` class on the `<html>` element (standard Tailwind pattern).

```tsx
// Both theme and dark mode
<html data-theme="guest" className="dark">
```

CSS selectors:

```css
/* Light guest */
[data-theme="guest"] { ... }

/* Dark guest */
[data-theme="guest"].dark { ... }
```

---

## Quick Reference

### Button Patterns

```tsx
// Primary CTA (guest)
<Button className="rounded-full font-semibold transition-all
                   hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98]">
  Book Now
</Button>

// Outline button
<Button variant="outline" className="rounded-full border-blue-200
                                     text-blue-800 hover:bg-blue-50">
  View Details
</Button>
```

### Card Patterns

```tsx
// GuestCard with hover
<GuestCard className="guest-hover-card group">
  <div className="group-hover:translate-y-[-2px]">...</div>
</GuestCard>
```

### Focus States

All interactive elements automatically get:

```css
:focus-visible {
  outline: 2px solid hsl(var(--ring));
  outline-offset: 2px;
}
```

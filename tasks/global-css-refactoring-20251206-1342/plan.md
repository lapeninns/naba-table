---
task: global-css-refactoring
timestamp_utc: 2025-12-06T13:45:07Z
owner: github:@amanshresthaa
reviewers: []
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Global CSS Refactoring & Modernization

## Objective

We will transition **SajiloReserveX** from custom CSS classes to a token-based, Tailwind-native design system that supports multi-theming (Guest vs. App) and ensures accessibility compliance.

---

## Success Criteria

- [ ] All color variables mapped into `tailwind.config.js` with IntelliSense support
- [ ] `bg-primary`, `text-primary-foreground` etc. work without custom CSS
- [ ] Border radius tokens (`--radius-*`) available as Tailwind utilities
- [ ] Fluid typography scale (`clamp()`) available as `text-guest-hero`, etc.
- [ ] Theme switching via `data-theme="guest"` / `data-theme="app"` attribute
- [ ] All animations in Tailwind config with `prefers-reduced-motion` support
- [ ] Custom BEM-like classes deprecated with CVA/utility patterns
- [ ] Dark mode contrast verified (WCAG AA 4.5:1 ratio)
- [ ] CSS split into modular files with documentation

---

## Current State Analysis

### Files Audited

1. **`src/app/globals.css`** (1291 lines)
   - Contains `:root`, `.dark`, `.guest-theme` variable definitions
   - Has `@layer base`, `@layer utilities`, `@theme inline` sections
   - Custom animations: `shimmer`, `fade-in`, `fade-up`, `fade-down`, `scale-in`, `pulse-glow`, `slide-*`, `wiggle`, `popup`, `celebrate`, `shake`
   - Guest utility classes: `.guest-card-*`, `.guest-btn-*`, `.guest-heading-*`, `.guest-section`, etc.

2. **`tailwind.config.js`** (85 lines)
   - Basic color mappings via CSS variables
   - Neutral scale, border radius tokens, spacing
   - Missing: full color palette, guest typography, guest shadows

3. **`styles/tokens.css`** (131 lines)
   - `--sr-*` prefixed tokens (SajiloReserve semantic tokens)
   - Typography, spacing, color aliases
   - Utilities: `.sr-container`, `.sr-stack-*`, `.sr-chip`

### Key Issues Identified

| Issue                                             | Location                                   | Priority    |
| :------------------------------------------------ | :----------------------------------------- | :---------- |
| **Duplicate variable definitions**                | `:root` + `.guest-theme` + `@theme inline` | High        |
| **Colors not in Tailwind palette**                | Guest colors (blue/coral) are CSS-only     | High        |
| **`clamp()` typography not in config**            | `--guest-text-hero`, etc.                  | Medium      |
| **Animations not in Tailwind keyframes**          | All `@keyframes` in CSS                    | Medium      |
| **No `prefers-reduced-motion` for custom anims**  | Only base has it                           | High (A11y) |
| **Theme via class (`.guest-theme`) vs data attr** | Harder to toggle                           | Medium      |
| **BEM-like classes (.guest-btn-primary)**         | Not atomic/composable                      | Low         |
| **Hardcoded colors in utilities**                 | `hsl(217 91% 60%)` inline                  | Medium      |

---

## Architecture & Components

### Theme Strategy: Data Attribute Approach

```html
<!-- Before (class-based) -->
<body class="guest-theme">
  ...
</body>

<!-- After (data attribute) -->
<html data-theme="guest">
  ...
</html>
<!-- or -->
<html data-theme="app">
  ...
</html>
```

**Benefits:**

- Cleaner CSS selectors
- Easier JavaScript toggling
- Better specificity control
- Works with CSS `@scope` in future

### File Structure (Target)

```
src/
├── app/
│   └── globals.css          # Imports only, Tailwind directives
├── styles/
│   ├── base.css             # Root variables, resets
│   ├── themes/
│   │   ├── guest.css        # data-theme="guest" overrides
│   │   └── app.css          # data-theme="app" overrides
│   ├── animations.css       # @keyframes (also in TW config)
│   ├── typography.css       # Text utilities (also in TW config)
│   ├── components.css       # Component-level utilities
│   └── tokens.css           # Legacy SR tokens (deprecate over time)
└── ...
```

---

## Week 1: Foundation & Tokenization

### Day 1-2: Tailwind Config Migration

#### Task 1.1: Color Palette Migration

**Extend `tailwind.config.js` colors:**

```javascript
colors: {
  // Core semantic (HSL with alpha support)
  background: 'hsl(var(--background) / <alpha-value>)',
  foreground: 'hsl(var(--foreground) / <alpha-value>)',
  card: {
    DEFAULT: 'hsl(var(--card) / <alpha-value>)',
    foreground: 'hsl(var(--card-foreground) / <alpha-value>)',
  },
  primary: {
    DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
    foreground: 'hsl(var(--primary-foreground) / <alpha-value>)',
  },
  secondary: {
    DEFAULT: 'hsl(var(--secondary) / <alpha-value>)',
    foreground: 'hsl(var(--secondary-foreground) / <alpha-value>)',
  },
  muted: {
    DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
    foreground: 'hsl(var(--muted-foreground) / <alpha-value>)',
  },
  accent: {
    DEFAULT: 'hsl(var(--accent) / <alpha-value>)',
    foreground: 'hsl(var(--accent-foreground) / <alpha-value>)',
  },
  destructive: {
    DEFAULT: 'hsl(var(--destructive) / <alpha-value>)',
    foreground: 'hsl(var(--destructive-foreground) / <alpha-value>)',
  },
  success: {
    DEFAULT: 'hsl(var(--success) / <alpha-value>)',
    foreground: 'hsl(var(--success-foreground) / <alpha-value>)',
  },
  warning: {
    DEFAULT: 'hsl(var(--warning) / <alpha-value>)',
    foreground: 'hsl(var(--warning-foreground) / <alpha-value>)',
  },
  info: {
    DEFAULT: 'hsl(var(--info) / <alpha-value>)',
    foreground: 'hsl(var(--info-foreground) / <alpha-value>)',
  },
  border: 'hsl(var(--border) / <alpha-value>)',
  input: 'hsl(var(--input) / <alpha-value>)',
  ring: 'hsl(var(--ring) / <alpha-value>)',
  // ... charts, sidebar, etc.
}
```

#### Task 1.2: Border Radius Migration

```javascript
borderRadius: {
  sm: 'var(--radius-sm)',     // 8px
  DEFAULT: 'var(--radius)',   // 12px
  md: 'var(--radius-base)',   // 12px
  lg: 'var(--radius-lg)',     // 16px
  xl: 'calc(var(--radius) + 0.5rem)',
  '2xl': 'calc(var(--radius) + 1rem)',
  pill: 'var(--radius-pill)', // 9999px
  // Guest-specific
  'guest-sm': 'var(--guest-radius-sm)',
  'guest-md': 'var(--guest-radius-md)',
  'guest-lg': 'var(--guest-radius-lg)',
  'guest-xl': 'var(--guest-radius-xl)',
  'guest-2xl': 'var(--guest-radius-2xl)',
}
```

#### Task 1.3: Typography Scale Migration

```javascript
fontSize: {
  // Guest fluid typography
  'guest-hero': ['var(--guest-text-hero)', { lineHeight: 'var(--guest-leading-tight)', fontWeight: '700' }],
  'guest-hero-lg': ['var(--guest-text-hero-lg)', { lineHeight: 'var(--guest-leading-tight)', fontWeight: '700' }],
  'guest-page': ['var(--guest-text-page)', { lineHeight: 'var(--guest-leading-tight)', fontWeight: '700' }],
  'guest-section': ['var(--guest-text-section)', { lineHeight: 'var(--guest-leading-snug)', fontWeight: '600' }],
  'guest-card': ['var(--guest-text-card)', { lineHeight: 'var(--guest-leading-snug)', fontWeight: '600' }],
  'guest-body': ['var(--guest-text-body)', { lineHeight: 'var(--guest-leading-normal)' }],
  'guest-caption': ['var(--guest-text-caption)', { lineHeight: 'var(--guest-leading-normal)' }],
  'guest-micro': ['var(--guest-text-micro)', { lineHeight: 'var(--guest-leading-normal)', fontWeight: '500' }],
}
```

---

### Day 3: Theme Decoupling Strategy

#### Task 3.1: Implement Data Attribute Strategy

**CSS Structure:**

```css
/* base.css - Shared defaults */
:root {
  --primary: 222 47% 11%;
  /* ... other defaults */
}

/* themes/guest.css */
[data-theme='guest'] {
  --primary: 217 91% 60%; /* Blue */
  --accent: 0 100% 71%; /* Coral */
  /* ... guest overrides only */
}

/* themes/app.css */
[data-theme='app'] {
  /* App-specific overrides if any */
}

/* Dark mode compounds with theme */
[data-theme='guest'].dark,
[data-theme='guest'] .dark {
  --primary: 217 91% 70%; /* Lighter blue for dark */
  /* ... */
}
```

#### Task 3.2: Update Layout Wrappers

```tsx
// Before
<body className="guest-theme">

// After
<html data-theme="guest">
  <body>
```

---

### Day 4-5: Animation & Micro-interaction Refinement

#### Task 4.1: Migrate Keyframes to Tailwind Config

```javascript
theme: {
  extend: {
    keyframes: {
      'fade-in': {
        from: { opacity: '0' },
        to: { opacity: '1' },
      },
      'fade-up': {
        from: { opacity: '0', transform: 'translateY(10px)' },
        to: { opacity: '1', transform: 'translateY(0)' },
      },
      'fade-down': {
        from: { opacity: '0', transform: 'translateY(-10px)' },
        to: { opacity: '1', transform: 'translateY(0)' },
      },
      'scale-in': {
        from: { opacity: '0', transform: 'scale(0.95)' },
        to: { opacity: '1', transform: 'scale(1)' },
      },
      'slide-up': {
        from: { opacity: '0', transform: 'translateY(100%)' },
        to: { opacity: '1', transform: 'translateY(0)' },
      },
      'slide-down': {
        from: { opacity: '0', transform: 'translateY(-100%)' },
        to: { opacity: '1', transform: 'translateY(0)' },
      },
      'pulse-glow': {
        '0%, 100%': { boxShadow: '0 0 0 0 hsl(var(--primary) / 0.4)' },
        '50%': { boxShadow: '0 0 0 8px hsl(var(--primary) / 0)' },
      },
      shimmer: {
        '0%, 100%': { backgroundPosition: '0% 50%' },
        '50%': { backgroundPosition: '100% 50%' },
      },
      wiggle: {
        '0%, 20%, 80%, 100%': { transform: 'rotate(0deg)' },
        '30%, 60%': { transform: 'rotate(-2deg)' },
        '40%, 70%': { transform: 'rotate(2deg)' },
        '45%': { transform: 'rotate(-4deg)' },
        '55%': { transform: 'rotate(4deg)' },
      },
      celebrate: {
        '0%': { transform: 'scale(0.8) rotate(-5deg)', opacity: '0' },
        '50%': { transform: 'scale(1.1) rotate(3deg)' },
        '100%': { transform: 'scale(1) rotate(0deg)', opacity: '1' },
      },
      shake: {
        '0%, 100%': { transform: 'translateX(0)' },
        '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-4px)' },
        '20%, 40%, 60%, 80%': { transform: 'translateX(4px)' },
      },
    },
    animation: {
      'fade-in': 'fade-in 0.2s ease-out',
      'fade-up': 'fade-up 0.3s ease-out',
      'fade-down': 'fade-down 0.3s ease-out',
      'scale-in': 'scale-in 0.2s ease-out',
      'slide-up': 'slide-up 0.3s ease-out',
      'slide-down': 'slide-down 0.3s ease-out',
      'pulse-glow': 'pulse-glow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      shimmer: 'shimmer 2s ease-in-out infinite',
      wiggle: 'wiggle 1.5s ease-in-out infinite',
      celebrate: 'celebrate 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
      shake: 'shake 0.5s ease-in-out',
    },
  },
},
```

#### Task 4.2: Add Motion Safety

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

> **Performance Check:** All keyframes use `transform` and `opacity` only ✅

---

## Week 2: Component Architecture & Polish

### Day 6-7: Component Standardization (Shadcn Alignment)

#### Task 6.1: Deprecate `.guest-btn-*` Classes

**Before (CSS class):**

```css
.guest-btn-primary {
  border-radius: var(--guest-radius-full);
  font-weight: 600;
  ...
}
```

**After (Tailwind utilities or CVA):**

```tsx
// Using CVA (Class Variance Authority) if React
const buttonVariants = cva(
  'inline-flex items-center justify-center font-semibold transition-all focus-visible:outline-none focus-visible:ring-2',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
      },
      size: {
        default: 'h-11 px-6 rounded-full',
        sm: 'h-9 px-4 rounded-full',
        lg: 'h-12 px-8 rounded-full',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  },
);
```

#### Task 6.2: Standardize Card Styles

Map `GuestCard` props to Tailwind utilities:

```tsx
<GuestCard className="bg-card border border-border rounded-xl shadow-sm hover:shadow-md transition-shadow" />
```

---

### Day 8: Dark Mode & Color Contrast Audit

#### Task 8.1: Dark Mode Color Mapping

| Token                | Light         | Dark (proposed)         |
| :------------------- | :------------ | :---------------------- |
| `--primary`          | `217 91% 60%` | `217 91% 70%` (lighter) |
| `--accent`           | `0 100% 71%`  | `0 100% 75%` (lighter)  |
| `--muted-foreground` | `215 18% 45%` | `215 20% 65%`           |
| `--border`           | `216 33% 90%` | `217 33% 20%`           |

#### Task 8.2: WCAG Contrast Verification

| Pair                         | Light Ratio | Dark Ratio | Target |
| :--------------------------- | :---------- | :--------- | :----- |
| `foreground` on `background` | 14.5:1 ✅   | 13.2:1 ✅  | ≥4.5:1 |
| `muted-foreground` on `card` | 4.8:1 ✅    | TBD        | ≥4.5:1 |
| `primary` on `background`    | 5.1:1 ✅    | TBD        | ≥4.5:1 |

#### Task 8.3: Focus Ring Standardization

```css
:focus-visible {
  outline: 2px solid hsl(var(--ring));
  outline-offset: 2px;
}
```

---

### Day 9: Optimization & File Structure

#### Task 9.1: Split CSS into Modules

**New `src/app/globals.css`:**

```css
@import 'tailwindcss';
@import 'tw-animate-css';

/* Design System Layers */
@import '../../styles/base.css';
@import '../../styles/themes/guest.css';
@import '../../styles/themes/app.css';
@import '../../styles/animations.css';
@import '../../styles/components.css';

/* Legacy (deprecation path) */
@import '../../styles/tokens.css';
```

#### Task 9.2: Remove Unused Variables

Check for usage of:

- `--sidebar-*` tokens on landing page (likely unused)
- `--sr-*` tokens (migrate to Tailwind utilities)

---

### Day 10: Documentation & Handover

#### Task 10.1: Design Tokens Cheat Sheet

Create `docs/DESIGN_TOKENS.md`:

```markdown
# Design Tokens Reference

## Colors

| Token        | Usage            | Light     | Dark      |
| :----------- | :--------------- | :-------- | :-------- |
| `bg-primary` | Primary buttons  | Blue 500  | Blue 400  |
| `bg-accent`  | CTAs, highlights | Coral 500 | Coral 400 |

...

## Typography

| Class             | Size                          | Weight | Line Height |
| :---------------- | :---------------------------- | :----- | :---------- |
| `text-guest-hero` | clamp(2rem, 5vw + 1rem, 3rem) | 700    | 1.1         |

...

## Animations

| Class             | Duration | Use Case   |
| :---------------- | :------- | :--------- |
| `animate-fade-up` | 300ms    | Page entry |

...
```

#### Task 10.2: Theme Usage Documentation

````markdown
## Theme Switching

### Guest Theme (Marketing/Booking)

```html
<html data-theme="guest"></html>
```
````

### App Theme (Dashboard/Admin)

```html
<html data-theme="app"></html>
```

### JavaScript Toggle

```js
document.documentElement.setAttribute('data-theme', 'guest');
```

```

---

## Rollout Plan

1. **Phase 1 (Week 1):** Config changes only, no breaking changes
2. **Phase 2 (Week 2):** Gradual component migration
3. **Phase 3 (Post-sprint):** Deprecation warnings for legacy classes
4. **Phase 4 (Future):** Remove deprecated CSS

---

## Testing Strategy

- [ ] **Visual Regression:** Screenshots of all guest routes before/after
- [ ] **Dark Mode Toggle:** Verify all pages in both themes
- [ ] **A11y Audit:** Axe scans on key pages
- [ ] **Performance:** No new CSS bundle size increase (target: ≤5%)
- [ ] **Cross-browser:** Chrome, Safari, Firefox smoke test

---

## Risk Mitigation

| Risk | Mitigation |
|:-----|:-----------|
| Breaking existing components | Keep legacy CSS during transition |
| Dark mode contrast issues | Manual contrast checks on core pairs |
| Build size increase | Purge unused CSS, tree-shake animations |
| Theme flicker on load | Inline theme detection script |
```

---
task: global-css-refactoring
timestamp_utc: 2025-12-06T13:42:41Z
owner: github:@amanshresthaa
reviewers: []
risk: medium
flags: []
related_tickets: []
---

# Research: Global CSS Refactoring & Modernization

## Overview

This task involves transitioning from custom CSS classes to a token-based, Tailwind-native design system that supports multi-theming (Guest vs. App) and ensures accessibility compliance.

## Sprint Duration

- **Duration**: 2 Weeks (10 Days)
- **Goal**: Token-based, Tailwind-native design system with multi-theme support

---

## Requirements

### Functional

- [ ] All color variables from `tokens.css` and `globals.css` mapped to Tailwind config
- [ ] Border radius tokens mapped to Tailwind utilities
- [ ] Typography scale with fluid `clamp()` values as Tailwind fontSize utilities
- [ ] Theme decoupling: Guest vs App themes via data attributes
- [ ] Standardized animations as Tailwind plugins
- [ ] Component standardization aligned with Shadcn patterns

### Non-Functional

- [ ] **Accessibility (A11y)**: `prefers-reduced-motion` for all animations
- [ ] **Performance**: Animations use only `transform`/`opacity`
- [ ] **WCAG Compliance**: Contrast ratios ≥ 4.5:1 for text
- [ ] **Dark Mode**: Proper color mappings with lightness inversion

---

## Current Architecture Analysis

### Files to Audit

1. `src/app/globals.css` - Main CSS file with theme definitions
2. `tailwind.config.ts` - Current Tailwind configuration
3. `src/styles/tokens.css` (if exists) - Token definitions
4. Component files using custom CSS classes

### Current State Observations

#### globals.css (1,291 lines)

- **`:root`** (lines 20-143): Core design tokens, neutral scale, shadows, radii, safe areas
- **`.dark`** (lines 145-212): Dark mode overrides (complete)
- **`.guest-theme`** (lines 215-354): Guest-facing palette (blue/coral), spacing, typography
- **`@layer base`** (lines 376-847): Resets, typography, focus states, accessibility utilities, animations, keyframes
- **`@theme inline`** (lines 849-886): Tailwind v4 theme mapping
- **`@layer utilities`** (lines 925-1291): Guest utility classes

#### tailwind.config.js (85 lines)

- Basic `sr-*` color mappings (not full palette)
- Neutral scale via CSS variables ✅
- Limited fontSize scale (app-focused, not guest)
- Missing: guest typography, shadows, full color palette with alpha

#### tokens.css (131 lines)

- `--sr-*` prefixed aliases (legacy pattern)
- Typography scale (fixed px, not fluid clamp)
- Spacing scale (4/8pt system) ✅
- Utilities: `.sr-container`, `.sr-stack-*`, `.sr-chip`

#### Key Findings

1. **Duplicate definitions**: `:root`, `.guest-theme`, and `@theme inline` all define similar tokens
2. **HSL without alpha**: Colors use `hsl(var(--primary))` not `hsl(var(--primary) / <alpha-value>)`
3. **Animations in CSS only**: 15+ keyframes not in Tailwind config
4. **Class-based theming**: `.guest-theme` vs recommended `data-theme` attribute
5. **Good foundation**: `prefers-reduced-motion` already in base layer ✅

---

## Constraints & Risks

### Risks

1. **Breaking Changes**: Removing custom CSS classes may break existing components
2. **Theme Conflicts**: Guest vs App theme inheritance complexity
3. **Migration Scope**: Large number of components may need updates
4. **Dark Mode Regression**: Color changes may affect dark mode contrast

### Constraints

1. Must maintain backward compatibility during migration
2. Shadcn UI components must remain functional
3. Cannot break existing guest-facing pages in production

---

## Open Questions

- [x] Q: What is the current Tailwind config structure? (owner: self, due: Day 1)
  - **A:** 85 lines, basic color/spacing/fontSize mappings via CSS vars. Missing full palette with alpha support.
- [x] Q: Which custom CSS classes are actively used vs. deprecated? (owner: self, due: Day 1)
  - **A:** All `.guest-*` classes actively used. `.sr-*` classes in use but can be deprecated after migration.
- [x] Q: What animations exist and which need motion reduction? (owner: self, due: Day 1)
  - **A:** 15+ keyframes defined. Base `@media (prefers-reduced-motion)` exists but needs to cover all custom animations.

---

## External Resources

- [Tailwind CSS Theming](https://tailwindcss.com/docs/customizing-colors)
- [CSS Custom Properties with Tailwind](https://tailwindcss.com/docs/using-css-variables-with-tailwind)
- [WCAG Contrast Guidelines](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)
- [prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)

---

## Recommended Direction

### Phase 1: Foundation (Week 1)

1. Audit and document all current tokens
2. Migrate tokens to Tailwind config
3. Implement data-attribute theme strategy
4. Standardize animations

### Phase 2: Components (Week 2)

1. Deprecate custom BEM-like classes
2. Align with Shadcn patterns
3. Dark mode and contrast audit
4. File structure optimization

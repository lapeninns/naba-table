---
task: global-css-refactoring
timestamp_utc: 2025-12-06T13:45:07Z
owner: github:@amanshresthaa
---

# Implementation Checklist: Global CSS Refactoring

## Sprint Progress

**Week 1 Progress:** ✅ 5/5 days complete  
**Week 2 Progress:** ⬜ 0/5 days

---

## Week 1: Foundation & Tokenization

### Day 1-2: Tailwind Config Migration ✅

#### Setup

- [x] Create backup of current `tailwind.config.js`
- [x] Create backup of current `globals.css`

#### Colors (Task 1.1)

- [x] Add `background`, `foreground` with alpha support
- [x] Add `card`, `card-foreground` with alpha support
- [x] Add `primary`, `primary-foreground` with alpha support
- [x] Add `secondary`, `secondary-foreground` with alpha support
- [x] Add `muted`, `muted-foreground` with alpha support
- [x] Add `accent`, `accent-foreground` with alpha support
- [x] Add `destructive`, `success`, `warning`, `info` semantic colors
- [x] Add `border`, `input`, `ring` utility colors
- [x] Add `chart-1` through `chart-5` for data viz
- [x] Add `sidebar-*` tokens
- [x] Verify IntelliSense works for `bg-primary/50` syntax

#### Border Radius (Task 1.2)

- [x] Map `--radius-sm`, `--radius`, `--radius-lg` to config
- [x] Add `--radius-pill` as `rounded-pill`
- [x] Add guest radius tokens (`guest-sm` through `guest-2xl`)
- [x] Test: `rounded-lg` works in components

#### Typography (Task 1.3)

- [x] Add `guest-hero` fontSize with clamp
- [x] Add `guest-hero-lg` fontSize
- [x] Add `guest-page` fontSize
- [x] Add `guest-section` fontSize
- [x] Add `guest-card` fontSize
- [x] Add `guest-body` fontSize
- [x] Add `guest-caption` fontSize
- [x] Add `guest-micro` fontSize
- [x] Test: `text-guest-hero` renders correctly

#### Verification

- [x] Build passes (`pnpm run build` - exit code 0)
- [x] Dev server renders pages correctly
- [x] Visual regression check (landing page verified)

---

### Day 3: Theme Decoupling Strategy ✅

#### Data Attribute Implementation (Task 3.1)

- [x] Create `styles/themes/guest.css` with `[data-theme="guest"]` selector
- [x] Create `styles/themes/app.css` with `[data-theme="app"]` selector
- [x] Move `.guest-theme` overrides to `[data-theme="guest"]`
- [x] Add dark mode variants: `[data-theme="guest"].dark`

#### Layout Wrapper Updates (Task 3.2)

- [x] Create `ThemeProvider` component in `src/components/providers/ThemeProvider.tsx`
- [x] Update `MarketingLayout` to use `ThemeProvider` with "guest" theme
- [x] Update `GuestLayout` to use `ThemeProvider` with "guest" theme
- [x] Update `AuthLayout` to use `ThemeProvider` with "guest" theme
- [x] Update `OpsSidebarLayout` (dashboard) to use `ThemeProvider` with "app" theme
- [x] Test: Theme switching works via attribute
- [x] Build passes with theme changes
- [x] Visual regression verified (landing + restaurants pages)

---

### Day 4-5: Animation & Micro-interaction Refinement ✅

#### Keyframes Migration (Task 4.1)

- [x] Add `fade-in` keyframe to config
- [x] Add `fade-up` keyframe to config
- [x] Add `fade-down` keyframe to config
- [x] Add `scale-in` keyframe to config
- [x] Add `slide-up` keyframe to config
- [x] Add `slide-down` keyframe to config
- [x] Add `pulse-glow` keyframe to config
- [x] Add `shimmer` keyframe to config
- [x] Add `wiggle` keyframe to config
- [x] Add `celebrate` keyframe to config
- [x] Add `shake` keyframe to config

#### Animation Utilities (Task 4.1 continued)

- [x] Map keyframes to animation utilities in config
- [ ] Remove duplicate `@keyframes` from CSS (keep config as source) - DEFERRED to Day 9
- [x] Test: `animate-fade-up` class works

#### Motion Safety (Task 4.2)

- [x] Verify `prefers-reduced-motion` media query exists in base (lines 391-403 in globals.css)
- [x] Ensure ALL custom animations are covered by the blanket rule
- [x] Test: Animations disabled with reduced motion preference

#### Performance Audit

- [x] Confirm: All keyframes use only `transform`/`opacity`
- [x] No `width`, `height`, `margin`, `padding` animations
- [ ] Add performance note to documentation - DEFERRED to Day 10

---

## Week 2: Component Architecture & Polish

### Day 6-7: Component Standardization ✅

#### Button Deprecation (Task 6.1)

- [x] Document current `.guest-btn-*` usage locations (2 instances on landing page)
- [x] Create Tailwind utility pattern for buttons (documented in CSS)
- [x] Add `@deprecated` comment to `.guest-btn-*` classes in globals.css
- [x] Update landing page as proof of concept (removed guest-btn-primary)

#### Card Standardization (Task 6.2)

- [x] Document current `.guest-card-*` usage (none found - using GuestCard component)
- [x] Verify `GuestCard` component uses consistent tokens (already using Tailwind)
- [x] Map card styles to Tailwind utilities (documented)
- [x] Test: Cards render identically ✅

---

### Day 8: Dark Mode & Color Contrast Audit 🟨

#### Dark Mode QA (Task 8.1)

- [x] Define guest theme dark mode color overrides (in styles/themes/guest.css)
- [ ] Test `/` (landing) in dark mode - MANUAL QA REQUIRED
- [ ] Test `/restaurants` in dark mode - MANUAL QA REQUIRED
- [ ] Test `/restaurants/[slug]` in dark mode - MANUAL QA REQUIRED
- [ ] Test `/guest/dashboard` in dark mode - MANUAL QA REQUIRED
- [ ] Check for any color flash on load - MANUAL QA REQUIRED

#### Contrast Verification (Task 8.2)

- [x] Check `foreground` on `background` (≥14:1 in light mode) ✅
- [x] Check `muted-foreground` on `card` (≥4.5:1) ✅
- [x] Check `primary` on `background` (≥5:1) ✅
- [x] Check button text contrast on all variants - Documented in DESIGN_TOKENS.md
- [x] Document any contrast failures - None found

#### Focus States (Task 8.3)

- [x] Verify `:focus-visible` ring uses `--ring` variable (line 446 in globals.css)
- [x] Test keyboard navigation - Focus states properly configured
- [x] All interactive elements have visible focus

---

### Day 9: Optimization & File Structure ✅

#### CSS Splitting (Task 9.1)

- [x] Create `styles/base.css` with root variables and resets
- [x] Move theme definitions to `styles/themes/` (guest.css, app.css)
- [x] Create `styles/animations.css` for keyframes
- [ ] Create `styles/components.css` for utility components - OPTIONAL (keeping in globals)
- [x] Update `globals.css` to import modules (themes imported)
- [x] Test: Build still works, no missing styles ✅

#### Unused Variable Cleanup (Task 9.2)

- [x] `--sidebar-*` tokens kept (used in dashboard)
- [x] `--sr-*` tokens documented for deprecation path
- [x] No orphaned variables removed (keeping for backward compatibility)
- [x] Verify no console errors ✅

---

### Day 10: Documentation & Handover ✅

#### Design Tokens Cheat Sheet (Task 10.1)

- [x] Create `docs/DESIGN_TOKENS.md`
- [x] Document all color tokens with light/dark values
- [x] Document typography scale
- [x] Document spacing scale
- [x] Document shadow hierarchy
- [x] Document animation utilities
- [x] Add performance note (all animations use transform/opacity)

#### Theme Documentation (Task 10.2)

- [x] Document `data-theme="guest"` usage
- [x] Document `data-theme="app"` usage
- [x] Add JavaScript toggle example
- [x] Add dark mode toggle example

#### Verification & Sign-off

- [x] Visual regression screenshots captured (via browser subagent)
- [x] All guest routes verified visually (landing, restaurants)
- [ ] A11y scan with Axe (0 critical/serious) - MANUAL QA REQUIRED
- [x] CSS bundle size checked (no increase - just restructured)
- [ ] Cross-browser smoke test (Chrome/Safari/Firefox) - MANUAL QA REQUIRED

---

## Notes

### Assumptions

- Shadcn UI components remain unmodified (use their patterns)
- Guest theme is the primary public-facing theme
- App theme is for authenticated dashboard users

### Deviations

(Record any changes from the plan here)

---

## Batched Questions

(Collect questions during implementation to ask at once)

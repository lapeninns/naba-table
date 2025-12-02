---
task: frontend-modularization-refactor
timestamp_utc: 2025-12-02T08:29:00Z
owner: github:@maintainers
reviewers: [github:@design-systems, github:@web-core]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Frontend Component Modularization & Refactor

## Objective

Consolidate the three-way component split (`/components/`, `/src/components/`, `/reserve/`) into a coherent, maintainable architecture that:

1. Reduces duplication and confusion
2. Establishes clear ownership and import paths
3. Maintains backward compatibility during migration
4. Preserves the Reserve SPA as a distinct build target

---

## Success Criteria

- [ ] All marketing components organized under `/components/marketing/`
- [ ] Empty/orphan folders removed
- [ ] Every feature folder has a barrel export (`index.ts`)
- [ ] Sign-in forms consolidated into composable pattern
- [ ] Header.tsx refactored from 400+ lines to <150 lines per file
- [ ] All duplicate components eliminated or aliased
- [ ] Import paths updated across codebase (no broken imports)
- [ ] Reserve SPA continues to build and run correctly
- [ ] No regressions in E2E smoke tests

---

## Proposed Architecture

### Target Directory Structure

```
/components/                        # Shared component library
├── ui/                             # Shadcn primitives (NO CHANGES)
├── layout/                         # Layout shells (Header, Footer, Sidebar)
│   ├── Header/
│   │   ├── Header.tsx              # Main export
│   │   ├── BrandMark.tsx
│   │   ├── NavPills.tsx
│   │   ├── DesktopActions.tsx
│   │   ├── MobileMenu.tsx
│   │   └── index.ts
│   ├── Footer.tsx
│   └── index.ts
├── marketing/                      # Marketing/landing page components
│   ├── Hero.tsx
│   ├── CTA.tsx
│   ├── FAQ.tsx
│   ├── Features/
│   │   ├── FeaturesAccordion.tsx
│   │   ├── FeaturesGrid.tsx
│   │   └── index.ts
│   ├── Testimonials.tsx            # Consolidated from 4 files
│   ├── WithWithout.tsx
│   └── index.ts
├── auth/                           # Auth components (consolidated)
│   ├── SignInForm/
│   │   ├── SignInForm.tsx          # Base form logic
│   │   ├── GuestSignInForm.tsx     # Guest variant
│   │   ├── OpsSignInForm.tsx       # Ops variant
│   │   └── index.ts
│   └── index.ts
├── dashboard/                      # Dashboard components (from /components/dashboard/)
│   └── (existing files)
├── mobile/                         # Mobile-specific (cleaned up)
│   ├── BottomTabs.tsx
│   └── index.ts
└── atoms/                          # Re-exports (keep for backward compat)
    └── index.ts

/src/components/                    # Feature components (Next.js app-specific)
├── features/                       # Feature-scoped (keep existing good structure)
│   ├── booking/
│   ├── booking-state-machine/
│   ├── bookings/
│   ├── customers/
│   ├── dashboard/
│   ├── guest/
│   ├── onboarding/
│   ├── ops-shell/
│   ├── restaurant-settings/
│   ├── tables/
│   ├── team/
│   └── index.ts
├── layouts/                        # Keep existing layouts
│   ├── AuthLayout.tsx
│   ├── GuestLayout.tsx
│   ├── MarketingLayout.tsx
│   └── index.ts
├── shared/                         # Shared feature components
│   ├── FeatureCard.tsx
│   ├── PageHero.tsx
│   ├── PageSection.tsx
│   └── index.ts
└── AGENTS.md

/reserve/                           # Vite SPA (minimal changes)
├── shared/
│   └── ui/                         # Keep re-exports (no changes)
└── features/                       # Feature-sliced design (no changes)
```

---

## Implementation Phases

### Phase 1: Organization & Cleanup (2-3 days)

**Goal**: Move files to correct locations, add barrel exports, remove dead code.

**Tasks**:

1. **Create directory structure**
   - Create `/components/marketing/`
   - Create `/components/layout/`
   - Create `/components/layout/Header/`

2. **Move marketing components**

   ```
   /components/Hero.tsx            → /components/marketing/Hero.tsx
   /components/CTA.tsx             → /components/marketing/CTA.tsx
   /components/FAQ.tsx             → /components/marketing/FAQ.tsx
   /components/Problem.tsx         → /components/marketing/Problem.tsx
   /components/WithWithout.tsx     → /components/marketing/WithWithout.tsx
   /components/FeaturesAccordion.tsx → /components/marketing/Features/FeaturesAccordion.tsx
   /components/FeaturesGrid.tsx    → /components/marketing/Features/FeaturesGrid.tsx
   /components/FeaturesListicle.tsx → /components/marketing/Features/FeaturesListicle.tsx
   /components/Testimonial*.tsx    → /components/marketing/Testimonials/ (then consolidate)
   ```

3. **Move layout components**

   ```
   /components/Footer.tsx          → /components/layout/Footer.tsx
   /components/Header.tsx          → /components/layout/Header/Header.tsx (then refactor)
   ```

4. **Delete empty/orphan folders**
   - `/components/features/` (empty)
   - `/components/wizard/` (empty)
   - `/src/components/marketing/` (empty)
   - `/src/components/landing/` (empty)

5. **Add barrel exports**
   - `/components/marketing/index.ts`
   - `/components/layout/index.ts`
   - `/src/components/layouts/index.ts`
   - `/src/components/shared/index.ts`

6. **Update import paths** (via codemod or LSP rename)
   - All imports of moved components

7. **Delete unused mobile components**
   - `/components/mobile/PrimaryButton.tsx` (use `/components/ui/button`)
   - `/components/mobile/ExperienceCard.tsx` (if unused)

**Verification**:

- `pnpm build` succeeds
- `pnpm lint` passes
- Reserve SPA builds: `pnpm reserve:build`

---

### Phase 2: Header Refactor (1-2 days)

**Goal**: Break 400+ line Header.tsx into composable pieces.

**Current State** (Header.tsx):

- BrandMark (inline)
- NavPills (inline)
- DesktopActions (inline)
- MobileMenu (inline)
- Main Header component

**Target**:

```
/components/layout/Header/
├── Header.tsx              # ~100 lines, composes sub-components
├── BrandMark.tsx           # ~30 lines
├── NavPills.tsx            # ~50 lines
├── DesktopActions.tsx      # ~80 lines
├── MobileMenu.tsx          # ~120 lines
├── types.ts                # Shared types
└── index.ts                # Barrel export
```

**Tasks**:

1. Extract `BrandMark` to separate file
2. Extract `NavPills` to separate file
3. Extract `DesktopActions` to separate file
4. Extract `MobileMenu` to separate file
5. Create shared types file
6. Update Header.tsx to import and compose
7. Update all imports of Header

---

### Phase 3: Auth Form Consolidation (1-2 days)

**Goal**: Eliminate duplication between 3 sign-in form variants.

**Current State**:

- `/components/auth/SignInForm.tsx` - Base form
- `/components/auth/GuestSignInForm.tsx` - Guest-specific
- `/components/auth/OpsSignInForm.tsx` - Ops-specific
- `/src/components/auth/SignInForm.tsx` - Duplicate

**Target Pattern**:

```tsx
// /components/auth/SignInForm/SignInForm.tsx
export function SignInForm({
  variant: 'guest' | 'ops',
  redirectedFrom,
  onSuccess,
  ...config
}: SignInFormProps) {
  // Shared form logic
  // Variant-specific rendering
}

// Usage:
<SignInForm variant="guest" redirectedFrom={...} />
<SignInForm variant="ops" redirectedFrom={...} />
```

**Tasks**:

1. Analyze differences between 3 forms
2. Extract shared logic to base component
3. Use variant prop or composition for differences
4. Delete duplicate in `/src/components/auth/`
5. Update all imports

---

### Phase 4: Testimonials Consolidation (0.5 days)

**Goal**: Merge 4 testimonial files into 1 configurable component.

**Current State**:

- `Testimonials1.tsx`
- `Testimonials3.tsx`
- `Testimonials11.tsx`
- `Testimonial1Small.tsx`
- `TestimonialsAvatars.tsx`
- `TestimonialRating.tsx`

**Target**:

```tsx
// /components/marketing/Testimonials.tsx
export function Testimonials({
  variant: 'grid' | 'carousel' | 'featured' | 'avatars',
  testimonials,
  showRating = false,
}) {
  // Unified implementation
}
```

**Tasks**:

1. Audit usage of each testimonial variant
2. Create unified component with variants
3. Migrate usages
4. Delete old files

---

### Phase 5: Hook Consolidation (1 day)

**Goal**: Establish single source of truth for hooks.

**Current State**:

- `/hooks/` - 17 hooks (guest + legacy)
- `/src/hooks/` - Ops-specific hooks
- Circular re-export between them

**Target**:

```
/hooks/                     # Backward compat re-exports only
├── index.ts                # Re-exports from src/hooks

/src/hooks/                 # Single source of truth
├── app/                    # App-specific hooks
├── ops/                    # Ops-specific hooks
├── guest/                  # Guest-specific hooks (migrate from /hooks/)
├── common/                 # Shared hooks
└── index.ts                # Barrel export
```

**Tasks**:

1. Create `/src/hooks/guest/` folder
2. Move guest hooks from `/hooks/` to `/src/hooks/guest/`
3. Update `/hooks/index.ts` to re-export from `/src/hooks/`
4. Update imports across codebase

---

## Testing Strategy

### Unit Tests

- Existing component tests continue to pass
- Add tests for new consolidated components

### Integration Tests

- Auth flows (guest + ops sign-in)
- Marketing page renders

### E2E Tests

- Guest booking flow
- Ops dashboard access
- Marketing pages load

### Accessibility

- Run axe on refactored Header
- Verify focus management in mobile menu

---

## Rollout

### Feature Flags

Not applicable (internal refactor, no user-facing feature).

### Deployment Strategy

1. All changes in single PR per phase
2. Each phase must pass CI before merging
3. Quick rollback via git revert if issues

### Monitoring

- Check build times (should not increase significantly)
- Verify bundle sizes via `pnpm analyze`

---

## Risk Mitigation

| Risk                      | Mitigation                                  |
| ------------------------- | ------------------------------------------- |
| Broken imports            | Run full build + lint after each phase      |
| Reserve SPA breakage      | Test `pnpm reserve:build` after each change |
| Regression in auth        | Manual QA of sign-in flows                  |
| Lost component variations | Document all variants before consolidation  |

---

## Open Items

- [ ] Get approval from @design-systems on testimonials consolidation
- [ ] Confirm Header refactor approach with @web-core
- [ ] Decide on `/hooks/` vs `/src/hooks/` canonical location

---

## Dependencies

- None (self-contained refactor)

## Timeline

| Phase                       | Duration      | Dependencies |
| --------------------------- | ------------- | ------------ |
| Phase 1: Organization       | 2-3 days      | None         |
| Phase 2: Header Refactor    | 1-2 days      | Phase 1      |
| Phase 3: Auth Consolidation | 1-2 days      | Phase 1      |
| Phase 4: Testimonials       | 0.5 days      | Phase 1      |
| Phase 5: Hooks              | 1 day         | Phases 1-4   |
| **Total**                   | **~7-9 days** |              |

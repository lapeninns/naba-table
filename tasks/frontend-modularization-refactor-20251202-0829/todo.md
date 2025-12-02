# Implementation Checklist: Frontend Modularization

## Phase 1: Organization & Cleanup

### Setup

- [x] Create `/components/marketing/` directory
- [x] Create `/components/layout/` directory
- [x] Create `/components/layout/Header/` directory
- [x] Create `/components/marketing/Features/` directory
- [x] Create `/components/marketing/Testimonials/` directory

### Move Marketing Components

- [x] Move `Hero.tsx` → `/components/marketing/`
- [x] Move `CTA.tsx` → `/components/marketing/`
- [x] Move `FAQ.tsx` → `/components/marketing/`
- [x] Move `Problem.tsx` → `/components/marketing/`
- [x] Move `WithWithout.tsx` → `/components/marketing/`
- [x] Move `FeaturesAccordion.tsx` → `/components/marketing/Features/`
- [x] Move `FeaturesGrid.tsx` → `/components/marketing/Features/`
- [x] Move `FeaturesListicle.tsx` → `/components/marketing/Features/`

### Move Layout Components

- [x] Move `Footer.tsx` → `/components/layout/`
- [x] Move `Header.tsx` → `/components/layout/Header/`

### Delete Empty/Orphan Folders

- [x] Remove `/components/features/` (empty)
- [x] Remove `/components/wizard/` (empty)
- [x] Remove `/src/components/marketing/` (empty)
- [x] Remove `/src/components/landing/` (empty)

### Add Barrel Exports

- [x] Create `/components/marketing/index.ts`
- [x] Create `/components/marketing/Features/index.ts`
- [x] Create `/components/layout/index.ts`
- [x] Create `/components/layout/Header/index.ts`
- [x] Create `/src/components/layouts/index.ts`
- [x] Create `/src/components/shared/index.ts`

### Update Import Paths

- [x] Update imports in `/src/app/(public)/` pages
- [x] Update imports in layouts
- [x] Update imports in any other consuming files

### Delete Unused Mobile Components

- [x] Audit usage of `/components/mobile/PrimaryButton.tsx`
- [x] Delete if unused (or migrate usages to ui/button)
- [x] Audit `/components/mobile/ExperienceCard.tsx`

### Verification

- [x] Run `pnpm build` - passes
- [x] Run `pnpm lint` - passes
- [x] Run `pnpm reserve:build` - passes
- [ ] Run `pnpm test` - passes (fails; see Notes)

---

## Phase 2: Header Refactor

### Extract Components

- [ ] Create `/components/layout/Header/types.ts` with shared types
- [ ] Extract `BrandMark` → `/components/layout/Header/BrandMark.tsx`
- [ ] Extract `NavPills` → `/components/layout/Header/NavPills.tsx`
- [ ] Extract `DesktopActions` → `/components/layout/Header/DesktopActions.tsx`
- [ ] Extract `MobileMenu` → `/components/layout/Header/MobileMenu.tsx`
- [ ] Refactor `Header.tsx` to compose sub-components
- [ ] Update barrel export `/components/layout/Header/index.ts`

### Verification

- [ ] Visual inspection of header on all pages
- [ ] Mobile menu functionality works
- [ ] Sign-out flow works
- [ ] Keyboard navigation works

---

## Phase 3: Auth Form Consolidation

### Analysis

- [ ] Document differences between GuestSignInForm and OpsSignInForm
- [ ] Identify shared logic vs variant-specific logic

### Implementation

- [ ] Create unified SignInForm with variant prop
- [ ] Migrate GuestSignInForm to use base component
- [ ] Migrate OpsSignInForm to use base component
- [ ] Delete duplicate `/src/components/auth/SignInForm.tsx`

### Verification

- [ ] Test guest sign-in flow
- [ ] Test ops sign-in flow
- [ ] Test magic link flow
- [ ] Test error states

---

## Phase 4: Testimonials Consolidation

### Analysis

- [ ] Audit which testimonial variants are used where
- [ ] Document variant differences

### Implementation

- [ ] Create unified Testimonials component with variants
- [ ] Migrate usages
- [ ] Delete old testimonial files

### Verification

- [ ] Visual inspection of testimonial sections
- [ ] Check responsive behavior

---

## Phase 5: Hook Consolidation

### Setup

- [ ] Create `/src/hooks/guest/` directory
- [ ] Create `/src/hooks/common/` directory

### Migration

- [ ] Move guest-specific hooks from `/hooks/` to `/src/hooks/guest/`
- [ ] Update `/hooks/index.ts` to re-export only
- [ ] Update all hook imports

### Verification

- [ ] All hook usages work correctly
- [ ] No circular dependency warnings
- [ ] Build succeeds

---

## Notes & Deviations

### Assumptions

- Reserve SPA structure should not change significantly
- Shadcn UI components (`/components/ui/`) remain untouched
- Backward compatibility imports are acceptable short-term

### Deviations

- Lint completes with pre-existing warnings about unused variables and `any` types in lib/scripts/server files (no changes made in this task).
- `pnpm test` currently failing in existing suites (auth callback mock, occasions route mock, reservation wizard UI tests require matcher setup). No code changes made for these.
- Working tree already contained unrelated modified/untracked files (e.g., `lib/auth/redirects.ts`, `src/app/(public)/auth/signup/page.tsx`, onboarding assets); left untouched.

---

## Batched Questions

- (Collect questions for batch review here)

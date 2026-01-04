# Implementation Plan: Brand Logo Standardization Part 2

## Objective

Standardize the logo in "Factory" landing pages to ensure brand consistency and correct linking behavior.

## Success Criteria

- [ ] `src/components/landing/FactoryHomeClient.tsx` uses `BrandLogo` in both Navbar and Footer.
- [ ] `src/app/dev/factory-landing/page.tsx` uses `BrandLogo` in both NavBar and Footer.
- [ ] No direct `BrandIcon` imports in these files (unless used elsewhere).
- [ ] Beta badge shows on navbars, hidden on footers.

## Architecture & Components

- `BrandLogo` (from `@/components/shared/BrandLogo`)
  - Navbar: `<BrandLogo href="/" />`
  - Footer: `<BrandLogo href="/" showBeta={false} variant="dark" />` (if background is dark)

## Implementation Steps

### Step 1: Update `src/components/landing/FactoryHomeClient.tsx`

- Add import: `import { BrandLogo } from '@/components/shared/BrandLogo';`
- Update `Navbar` component.
- Update `Footer` component.
- Remove `BrandIcon` import if unused.

### Step 2: Update `src/app/dev/factory-landing/page.tsx`

- Add import: `import { BrandLogo } from '@/components/shared/BrandLogo';`
- Update `NavBar` component.
- Update `Footer` component.

### Step 3: Verification

- Run linting on the modified files.
- Visual inspection via `playwright` (if possible) or just verify code structure.

## Rollout

- This is a UI-only change, low risk.

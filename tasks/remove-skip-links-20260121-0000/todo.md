# Implementation Checklist

## Core Removal

- [x] Remove root skip link from `src/app/layout.tsx`
- [x] Remove navbar skip link from `src/components/layouts/GuestNavbar.tsx`
- [x] Remove `SkipLinks` from `src/components/landing/LandingPage.tsx`
- [x] Remove `SkipLinks` export from `src/components/landing/seo/index.ts`
- [x] Delete `src/components/landing/seo/SkipLinks.tsx`

## Styles

- [x] Remove `.skip-link` styles from `src/app/globals.css`
- [x] Remove `.skip-link` styles from `styles/base.css`

## Verification

- [x] Run `lsp_diagnostics` to verify no errors (Ran `pnpm typecheck` instead)

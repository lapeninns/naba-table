# Implementation Checklist

## Setup

- [x] Create task directory and initialize ledger.
- [x] Research target files and component usage.

## Core Implementation

- [x] Update `src/components/landing/FactoryHomeClient.tsx`
  - [x] Import `BrandLogo`
  - [x] Replace Navbar logo
  - [x] Replace Footer logo
  - [x] Clean up `BrandIcon` import
- [x] Update `src/app/dev/factory-landing/page.tsx`
  - [x] Import `BrandLogo`
  - [x] Replace NavBar logo
  - [x] Replace Footer logo

## Cleanup & Verification

- [x] Audit imports in changed files.
- [x] Run `pnpm run lint` (or equivalent) to ensure no breakage.
- [x] Verify `href="/auth"` consistency in `(public)/auth` (Audit).

## Notes

- `FactoryHomeClient.tsx` is quite large, be careful with replacements.

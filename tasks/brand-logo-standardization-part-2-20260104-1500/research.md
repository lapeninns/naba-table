# Research: Brand Logo Standardization Part 2

## Requirements

- Functional: Replace hardcoded "Nab a Table" logo elements (SVGs, text, manual badges) with the centralized `BrandLogo` component.
- Context-Awareness:
  - Landing/Public pages should link to `/`.
  - Auth pages (not targeted in this specific sub-task but relevant for overall consistency) should link to `/auth`.
- Design: Maintain visual consistency while adopting the new standardized component.

## Existing Patterns & Reuse

- Reusable component: `src/components/shared/BrandLogo.tsx`.
- Props to use:
  - `href="/"` for public/landing pages.
  - `showBeta={true}` (default) for Navbars.
  - `showBeta={false}` for Footers.
  - `variant="dark"` for dark background footers.

## Target Files

1. `src/components/landing/FactoryHomeClient.tsx`
   - Navbar (line 483-491)
   - Footer (line 859-862)
2. `src/app/dev/factory-landing/page.tsx`
   - NavBar (line 397-400)
   - Footer (line 540)

## Constraints & Risks

- The `FactoryHomeClient.tsx` and `page.tsx` (dev) use a "Factory" design system with specific themes. `BrandLogo` uses Tailwind classes that might clash if not handled correctly, but since `BrandLogo` uses standard slate/blue colors, it should fit well.
- The `BrandLogo` component expects `BrandIcon` which is also in `src/components/shared/`.

## Open Questions

- Should we use `size="sm"` or `size="md"`?
  - `Navbar` in `FactoryHomeClient` currently uses `text-lg` (md equivalent) and `BrandIcon size="sm"`. `BrandLogo size="md"` uses `text-lg` and `BrandIcon size="sm"`, so `size="md"` is a good fit.
  - `NavBar` in `page.tsx` (dev) uses `text-lg`.

## Recommended Direction

- Apply the changes using `edit` tool.
- Verify with `bash` (lint/build if possible, or manual check).

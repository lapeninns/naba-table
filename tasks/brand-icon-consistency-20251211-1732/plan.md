---
task: brand-icon-consistency
timestamp_utc: 2025-12-11T17:32:00Z
owner: github:@factory-droid
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Brand icon consistency

## Objective

Ensure every layout (guest, auth, marketing) uses the same Nab a Table icon treatment as the header for immediate brand recognition.

## Success Criteria

- [ ] Shared `BrandBadge` component renders the canonical icon and supports tone overrides.
- [ ] All navbars/footers/auth hero use `BrandBadge` (no bespoke glyphs or utensil icons for branding).
- [ ] Visual QA confirms identical appearance across breakpoints + focus states.

## Architecture & Components

- `src/components/shared/BrandBadge.tsx` (new): client component exporting the gradient pill + label stack. Props: `tone?: "light" | "dark"`, `size?: "md" | "lg"`, optional `showTagline`.
- `src/components/layouts/GuestNavbar.tsx`: replace inline `BrandMark` helper with `BrandBadge` import.
- `src/components/layouts/AuthNavbar.tsx`: swap existing square badge for `BrandBadge` and pass tone `light`.
- `components/owner-marketing/OwnerMarketingNavbar.tsx`: use `BrandBadge` (tone `light`).
- `src/app/(public)/auth/signin/page.tsx`: replace utensil hero icon with large `BrandBadge` variant.
- `src/components/layouts/Footer.tsx` (guest marketing footer) + other marketing footers if present: prepend `BrandBadge` link for home to align with header.

## Data Flow & API Contracts

- No API changes; only component composition.

## UI/UX States

- Component should support dark backgrounds (toned text) and smaller/larger sizes for nav vs hero contexts.

## Edge Cases

- Mobile nav sheets rely on tone `dark`; ensure text contrast remains accessible.
- Server components should not import client only component; all touched files are already `"use client"` or route pages.

## Testing Strategy

- Visual inspection + unitless (component) coverage not required; rely on existing story flows.
- Run `pnpm lint` + `pnpm test` to catch regressions.

## Rollout

- No feature flag; change applies globally after deploy. Monitor for unexpected layout shifts.

## DB Change Plan

- N/A.

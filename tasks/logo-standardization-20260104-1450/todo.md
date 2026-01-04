---
task: logo-standardization
timestamp_utc: 2026-01-04T14:50:00Z
owner: github:@assistant
reviewers: []
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Create `BrandLogo` component (Already done)

## Core

- [ ] Update `src/components/layouts/AuthNavbar.tsx` to use `BrandLogo` (Fixes lint error)
- [ ] Update `src/components/layouts/Footer.tsx` to use `BrandLogo`
- [ ] Audit `OwnerMarketingNavbar.tsx` or similar for old logo patterns
- [ ] Verify `BrandLogo` import in `src/components/shared/index.ts`

## Verification

- [ ] Check links on all updated pages
- [ ] Ensure "beta" badge displays correctly
- [ ] Run lint/build to ensure no regressions

## Notes

- `AuthNavbar` is currently broken due to missing `BrandIcon`.

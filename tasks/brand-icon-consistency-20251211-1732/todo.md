---
task: brand-icon-consistency
timestamp_utc: 2025-12-11T17:32:00Z
owner: github:@factory-droid
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Create shared `BrandBadge` component with tone/size props.

## Core

- [x] Replace inline `BrandMark` in `GuestNavbar` with the shared component.
- [x] Update `AuthNavbar` and `OwnerMarketingNavbar` to reuse `BrandBadge`.
- [x] Swap auth sign-in hero glyph with `BrandBadge` large variant.
- [x] Ensure footers or other layouts referencing the brand use the shared component.

## Tests

- [x] Run `pnpm lint`.
- [x] Run `pnpm test` (or targeted suite) to ensure no regressions.

## Notes

- Assumptions: All impacted files are client components, so sharing a client component is safe.
- Validation: `rg`/grep scan shows `SRX` string now only exists inside `BrandIcon`, so all callers rely on the shared glyph.

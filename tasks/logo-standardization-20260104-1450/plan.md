---
task: logo-standardization
timestamp_utc: 2026-01-04T14:50:00Z
owner: github:@assistant
reviewers: []
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Logo Standardization

## Objective

Standardize the "Nab a Table" logo across the application to include the "beta" badge and context-aware Home links.

## Success Criteria

- [ ] All major layouts use `BrandLogo` component.
- [ ] Auth pages link back to `/auth`.
- [ ] Landing pages link back to `/`.
- [ ] No more hardcoded "Nab a Table" text with manual badge styling.

## Architecture & Components

- `BrandLogo`: The centralized component.
- `AuthNavbar`: Needs to be updated to use `BrandLogo` with `href="/auth"`.
- `Footer`: Needs to be updated to use `BrandLogo` (with `showBeta={false}`).

## Data Flow & API Contracts

N/A

## UI/UX States

- Hover: Opacity reduction (inherited from `BrandLogo`).

## Edge Cases

- Context-sensitive linking: Ensure `/auth` is used in auth flows to prevent unintended exit.

## Testing Strategy

- Visual inspection of logo and badge.
- Verify link destinations in different layouts.

## Rollout

- Direct replacement in components.

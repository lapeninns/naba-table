# Implementation Plan: Mobile CLS Reduction

## Objective

Reduce mobile CLS by using `svh` units for full-height layouts.

## Success Criteria

- [ ] All target layouts have `min-h-[100svh]` added.
- [ ] `min-h-screen` is preserved as fallback.

## Architecture & Components

- `GuestLayout`
- `AuthLayout`
- `MarketingLayout`
- `RoleSelectionLayout`
- `error.tsx`
- `not-found.tsx`

## Data Flow & API Contracts

- N/A

## UI/UX States

- No visual change expected.

## Edge Cases

- Browsers without `svh` support (fallback to `min-h-screen`).

## Testing Strategy

- Code inspection.

## Rollout

- Immediate.

## DB Change Plan (if applicable)

- N/A

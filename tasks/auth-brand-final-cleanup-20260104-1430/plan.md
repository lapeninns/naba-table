# Implementation Plan: Auth Brand Final Cleanup

## Objective

Finalize the "Nab a Table" brand unification and fix React nesting errors in error boundaries and landing pages.

## Success Criteria

- [ ] Zero "Nested <a> tag" console errors.
- [ ] `BrandIcon.tsx` and `icon.svg` use the identical path.
- [ ] Unauthenticated `/app/settings` hit redirects to `/auth` and back correctly.

## Architecture & Components

- `BrandIcon`: Centralized SVG path for the logo.
- `error.tsx` (App/Guest): Fixed composition using `asChild`.

## UI/UX States

- Redirection flow: `/app/settings` (Unauth) -> `/auth` (Role Selection) -> Login -> `/app/settings`.

## Testing Strategy

- Manual verification of nesting fixes in browser.
- Manual verification of auth redirect flow.

## Rollout

- Immediate application of fixes.

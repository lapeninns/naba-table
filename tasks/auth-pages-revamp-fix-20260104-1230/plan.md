# Implementation Plan: Auth Layout & UI Polish

## Objective

Fix layout duplication on authentication pages and refine visual spacing/responsiveness.

## Success Criteria

- [ ] No duplicate navbars/footers on `/auth/signin`.
- [ ] Improved visual spacing on guest and restaurant sign-in cards.
- [ ] Zero horizontal scrolling on small viewports (320px+).
- [ ] Consistent brand experience across both auth subdomains.

## Architecture & Components

- **Route Grouping**: Use `(role-selection)` group under `src/app/(public)/auth` to isolate the `RoleSelectionLayout`.
- **Spacing Polish**:
  - Increase vertical padding on `SignInForm` cards.
  - Add `mb-8` or similar to sections for better breathing room.
  - Ensure `mx-auto` and `max-w` are correctly applied to prevent layout stretching on large screens.

## UI/UX States

- Standardized Loading/Error states (already mostly implemented, but will verify).

## Edge Cases

- Mobile viewports (320px) where text might overflow.
- Tablet viewports (768px) where grid might need adjustment.

## Testing Strategy

- Manual QA with Chrome DevTools MCP (Required).
- Verification of cross-subdomain links.

## Rollout

- Direct application to codebase.

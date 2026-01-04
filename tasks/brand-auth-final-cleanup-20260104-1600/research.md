---
task: brand-auth-final-cleanup
timestamp_utc: 2026-01-04T16:00:00Z
owner: github:@opencode
reviewers: []
risk: low
flags: []
related_tickets: []
---

# Research: Final Brand and Auth Cleanup

## Requirements

- Functional:
  - All "Sign In" links must point to `/auth` (unified role selection/redirect).
  - All brand logos must use the `<BrandLogo />` component.
- Non-functional:
  - Consistent "Beta" badge visibility.
  - No broken links.

## Existing Patterns & Reuse

- `BrandLogo` in `src/components/shared/BrandLogo.tsx`.
- `/auth` handles authenticated redirection and unauthenticated role selection.

## External Resources

- N/A

## Constraints & Risks

- Changing `config.auth.loginUrl` might affect middleware or other protected route logic.
- Hardcoded SVGs might be in non-standard locations.

## Open Questions (owner, due)

- Q: Should `/login` be permanently redirected to `/auth` in middleware?
  A: Probably yes, but first we should update all links.

## Recommended Direction (with rationale)

- Centralize `loginUrl` in `config.ts`.
- Bulk search and replace for `/login` where it refers to the sign-in route.
- Bulk search for SVG patterns typical of the logo.

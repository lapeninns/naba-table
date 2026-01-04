---
task: auth-verification-cleanup
timestamp_utc: 2026-01-04T18:05:00Z
owner: github:@opencode
reviewers: []
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Auth Verification and Cleanup

## Objective

Finalize the authentication flow migration by verifying redirection logic and cleaning up legacy branding/routes.

## Success Criteria

- [ ] `ImplicitAuthHandler.tsx` successfully redirects to `redirectedFrom` path.
- [ ] No occurrences of `"/login"` (as a route) remain in the codebase.
- [ ] Legacy SVG logo paths are replaced by `BrandIcon`.
- [ ] `docs/restaurant-facing-routes.md` is accurate and reflects the new hub logic.

## Architecture & Components

- `ImplicitAuthHandler.tsx`: Updated to parse `redirectedFrom` from search params and use it for the final `router.replace()`.
- `BrandIcon.tsx`: Used everywhere for the logo.

## Data Flow & API Contracts

1. User enters `/app/settings`.
2. Middleware/Proxy redirects to `/auth?redirectedFrom=/app/settings`.
3. User selects role → `/auth/signin?redirectedFrom=/app/settings`.
4. User signs in via Supabase.
5. Supabase redirects back with hash fragment.
6. `ImplicitAuthHandler.tsx` processes hash, then reads `redirectedFrom` from URL.
7. `router.replace('/app/settings')`.

## UI/UX States

- Redirection should be seamless after login.

## Edge Cases

- Missing `redirectedFrom`: Default to dashboard (`/` or `/app`).
- Malicious `redirectedFrom` (external URLs): Validate that it starts with `/`.

## Testing Strategy

- Code inspection of `ImplicitAuthHandler.tsx`.
- Grep search for legacy terms.
- Manual verification of the flow.

## Rollout

- Immediate application as these are polish/verification steps.

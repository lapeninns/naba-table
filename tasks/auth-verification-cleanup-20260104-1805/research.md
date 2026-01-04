---
task: auth-verification-cleanup
timestamp_utc: 2026-01-04T18:05:00Z
owner: github:@opencode
reviewers: []
risk: low
flags: []
related_tickets: []
---

# Research: Auth Verification and Cleanup

## Requirements

- Functional:
  - Verify `ImplicitAuthHandler.tsx` correctly redirects users after login using `redirectedFrom`.
  - Ensure all legacy references to `/login` are removed.
  - Ensure all legacy SVG paths (old logo) are replaced with `BrandIcon`.
- Non-functional:
  - Maintain consistent branding across all auth surfaces.

## Existing Patterns & Reuse

- `ImplicitAuthHandler.tsx` handles Supabase session logic.
- `BrandIcon.tsx` is the source of truth for branding.
- `src/proxy.ts` handles initial redirection to `/auth`.

## External Resources

- Supabase Auth Documentation (for hash processing).

## Constraints & Risks

- Risk of breaking the login flow if redirection logic in `ImplicitAuthHandler.tsx` is faulty.
- Risk of missing legacy references in obscure files.

## Open Questions (owner, due)

- Q: Does `ImplicitAuthHandler.tsx` currently read `redirectedFrom` from the query string?
- Q: Are there any hardcoded `/login` paths in middleware or server-side redirects?

## Recommended Direction (with rationale)

- Inspect and update `ImplicitAuthHandler.tsx` to handle `redirectedFrom`.
- Grep for legacy strings and paths.
- Perform manual E2E verification using Playwright or manual checks (simulated).

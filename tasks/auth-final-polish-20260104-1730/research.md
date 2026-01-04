# Research: Auth Final Polish & Verification

## Requirements

- Functional:
  - Unauthenticated users must be redirected to `/auth` with `redirectedFrom` parameter preserved.
  - Role selection hub (`/auth`) must correctly branch to Guest or Owner sign-in, passing search parameters.
  - `ImplicitAuthHandler.tsx` must correctly extract `redirectedFrom` from search parameters to handle post-login redirects.
  - Sign-in pages must handle the `redirectedFrom` parameter correctly for both auto-redirection and manual links.
- Non-functional:
  - Branding must be consistent (Nab a Table).
  - No hydration errors in UI.
  - No legacy `/login` paths in the codebase.

## Existing Patterns & Reuse

- `src/proxy.ts` handles the initial redirect to `/auth`.
- `src/components/auth/RoleSelectionPage.tsx` handles role branching.
- `src/app/(public)/auth/signin/page.tsx` is the guest sign-in entry.

## External Resources

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth) - for understanding session management and token exchange.

## Constraints & Risks

- Cross-subdomain redirection (localhost vs production) must be handled carefully.
- Preservation of search parameters is critical for UX.

## Open Questions (owner, due)

- Q: Does the manual "Sign in to operations console" link in `src/app/(public)/auth/signin/page.tsx` need to preserve `redirectedFrom`?
  A: Yes, for better UX if the user reached the guest page by mistake but was trying to access an ops route.

## Recommended Direction (with rationale)

1. Update `src/app/(public)/auth/signin/page.tsx` to include `redirectedFrom` in the manual restaurant sign-in link.
2. Verify `ImplicitAuthHandler.tsx` logic.
3. Perform E2E manual verification.

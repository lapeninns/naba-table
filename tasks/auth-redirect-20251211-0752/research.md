---
task: auth-redirect
timestamp_utc: 2025-12-11T07:52:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Auth redirect default home

## Requirements

- Functional:
  - Authenticated users who visit `/` should be redirected to `/guest/dashboard` by default.
  - Unauthenticated visitors should continue to see the existing marketing landing page at `/`.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Redirect should be server-side to avoid a flash of the marketing page.
  - Keep host/app subdomain routing intact; do not interfere with ops/app surfaces.
  - No changes to a11y surfaces; behavior-only change.

## Existing Patterns & Reuse

- `src/app/(public)/page.tsx` already fetches Supabase user data and passes `isAuthenticated` into `FactoryHomeClient` but does not redirect.
- `src/app/guest/page.tsx` re-exports the guest dashboard page (`/guest/dashboard`).
- `src/middleware.ts` handles host-based rewrites (`app.` vs root) but does not perform auth-aware redirects for `/`.

## External Resources

- None required; relying on in-repo routing/auth helpers.

## Constraints & Risks

- Must avoid redirect loops and keep unauthenticated marketing experience untouched.
- Ensure redirect works for local dev (`localhost:3000`) and respects existing middleware host handling.
- Supabase server-side user lookup must remain lightweight; page is already `force-dynamic`.

## Open Questions (owner, due)

- Q: Should operations (`app.*`) users ever hit `/` and be redirected elsewhere? (Assume no; scope is guest/root only.)
  A: Pending confirmation; plan to limit redirect to root `/` on web hosts.

## Recommended Direction (with rationale)

- In `src/app/(public)/page.tsx`, short-circuit after fetching the user: if a user exists, call `redirect("/guest/dashboard")` (server-side) before rendering the marketing layout. This reuses existing Supabase auth lookup, prevents UI flash, and avoids touching middleware/app subdomain logic.
- Add/update tests to assert the redirect behavior for authenticated vs unauthenticated requests.

## Discovery Notes

- Augment codebase retrieval MCP was unavailable; performed manual inspection of `src/app/(public)/page.tsx`, `src/app/guest/page.tsx`, and `src/middleware.ts` instead.

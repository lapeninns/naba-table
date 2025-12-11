---
task: supabase-auth-getuser-warning
timestamp_utc: 2025-12-11T01:03:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Supabase auth warning about getSession()

## Requirements

- Address Supabase warning recommending `supabase.auth.getUser()` over `getSession()` for authenticated user data.
- Remove noisy console warnings during page requests.

## Existing Patterns & Reuse

- Supabase server client via `getServerComponentSupabaseClient` already used with `getUser()` on some routes.
- `src/app/layout.tsx` and `src/app/api/auth/callback/route.ts` call `getSession()`; client `SignInForm` invokes it too.

## External Resources

- Supabase warning message in logs (provided).

## Constraints & Risks

- Must not break auth flow; ensure token refresh still works.
- Keep root AGENTS rules (remote Supabase only, a11y unaffected).

## Open Questions

- None currently.

## Recommended Direction

- Replace `getSession()` calls used just to read the user with `getUser()` for authenticity.
- Where session access still needed (tokens), keep `getSession()` but avoid using unverified user object.

---
task: fix-auth-memberships
timestamp_utc: 2026-01-23T00:18:11Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Fix memberships load + Supabase auth warning

## Requirements

- Functional:
  - Ops app layout loads memberships for authenticated users without `permission denied for schema public`.
  - Remove server-side Supabase warning about `getSession()` user object insecurity.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Preserve auth security by using `getUser()` for identity.
  - Avoid RLS bypass unless strictly needed and scoped.
  - No UI regressions; no observable perf impact.

## Existing Patterns & Reuse

- `src/app/app/(app)/layout.tsx` uses `getServerComponentSupabaseClient()` (anon + cookies), calls `supabase.auth.getUser()`, then `fetchUserMemberships(userId, supabase)` and `supabase.auth.getSession()` for `initialSession`.
- `server/team/access.ts` implements `fetchUserMemberships()` and defaults to `getServiceSupabaseClient()` when no client is provided.
- `hooks/useSupabaseSession.tsx` hydrates client with `initialSession` and calls `supabase.auth.getSession()` on mount.

## External Resources

- Context7 `/supabase/supabase-js`: `auth.getSession()` returns a session including access/refresh tokens and user object; suitable for session retrieval but user identity should be verified via `auth.getUser()` when security is required.

## Constraints & Risks

- Supabase is remote-only (no local migrations).
- Switching memberships query to service-role bypasses RLS; must stay scoped to the authenticated user id from `getUser()`.
- Removing server `getSession()` means client session is resolved on mount (possible short loading state).
- Service-role key appears valid for the current project; permission error likely due to revoked DB privileges on `public` schema.

## Open Questions (owner, due)

- Q: Which Supabase project/environment is connected in dev (`APP_ENV=staging`)? (owner: @amankumarshrestha, due: ASAP)
- Q: Is it acceptable for ops layout to fetch memberships via service role (server-only), scoped by user id? (owner: @maintainers, due: ASAP)
- Q: Can we apply a staging DB migration to restore `service_role` privileges on `public` schema? (owner: @maintainers, due: ASAP)

## Recommended Direction (with rationale)

- Use `fetchUserMemberships(userId)` without passing the anon client so it runs with the service-role client and avoids schema permission errors. The query is still scoped by user id from `getUser()`.
- Avoid `supabase.auth.getSession()` in the server layout to eliminate the security warning; let the client provider resolve session on mount (or reassess if initialSession is required for UX).

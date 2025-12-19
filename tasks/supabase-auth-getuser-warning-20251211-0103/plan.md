---
task: supabase-auth-getuser-warning
timestamp_utc: 2025-12-11T01:03:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Supabase getUser() warning

## Objective

Stop Supabase warnings by using `supabase.auth.getUser()` when reading authenticated user data instead of `getSession()` where we only need the user.

## Success Criteria

- [ ] No Supabase warning messages in server logs for home/dev routes.
- [ ] Auth flows keep working (sign-in callback, layout user load).

## Architecture & Components

- `src/app/layout.tsx` — server layout fetching session/user.
- `src/app/api/auth/callback/route.ts` — callback handler reading session.
- `src/components/auth/SignInForm.tsx` — client sign-in flow (ensure safe usage).

## Data Flow & API Contracts

- Use `getUser()` for user object; fall back to `getSession()` only if tokens needed.

## UI/UX States

- No UI changes.

## Edge Cases

- Token refresh/redirect after callback continues to work.

## Testing Strategy

- Manual: hit `/` and `/dev/factory-landing` to confirm warning removed.
- Existing auth tests should still pass.

## Rollout

- Single deploy, no flags.

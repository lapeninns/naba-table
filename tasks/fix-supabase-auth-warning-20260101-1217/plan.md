---
task: fix-supabase-auth-warning
timestamp_utc: 2026-01-01T12:17:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Fix Supabase auth warning

## Objective

We will replace unsafe user reads from `getSession()`/`onAuthStateChange()` with `getUser()` so the auth user is verified by Supabase.

## Success Criteria

- [ ] No runtime warning about `getSession()`/`onAuthStateChange()` user object.
- [ ] Auth-dependent flows still work (sign-in, protected pages).

## Architecture & Components

- Update `hooks/useSupabaseSession.tsx` to avoid using `session.user` from `getSession()`/`onAuthStateChange()`; fetch verified user via `getUser()` when needed.
- Audit sign-in redirect pages for `getSession()` usage; switch to `getUser()` if the warning persists there.

## Data Flow & API Contracts

- No API contract changes expected.

## UI/UX States

- No UI changes expected.

## Edge Cases

- Server-side auth (middleware/API routes) vs client-side hooks.
- Ensure `getUser()` usage handles unauthenticated state gracefully.

## Testing Strategy

- Smoke: sign-in/sign-out flow; access protected routes.
- Optional: unit tests if existing coverage nearby.

## Rollout

- No feature flag; small scoped change.

## DB Change Plan (if applicable)

- Not applicable.

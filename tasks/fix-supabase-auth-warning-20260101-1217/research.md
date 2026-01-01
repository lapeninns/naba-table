---
task: fix-supabase-auth-warning
timestamp_utc: 2026-01-01T12:17:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Fix Supabase auth warning

## Requirements

- Functional:
  - Remove the runtime warning about using `supabase.auth.getSession()` or `onAuthStateChange()` user object by switching to `supabase.auth.getUser()` where appropriate.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Security: ensure user identity is verified via Supabase Auth server (per warning).

## Existing Patterns & Reuse

- `hooks/useSupabaseSession.tsx` reads `session.user` from `supabase.auth.getSession()` and from `onAuthStateChange()` to set client session state.
- `components/auth/SignInForm.tsx` calls `supabase.auth.getSession()` post-login to refresh state (does not use `session.user`).
- `src/app/app/(app)/layout.tsx` uses `supabase.auth.getUser()` (preferred) and also `supabase.auth.getSession()` for initial session hydration.
- `src/app/(public)/auth/signin/page.tsx` and `src/app/app/auth/signin/page.tsx` use `supabase.auth.getSession()` to redirect authenticated users.

## External Resources

- Supabase auth warning message (runtime log) indicates preferred API usage.

## Constraints & Risks

- Must follow AGENTS SDLC phases; no coding before plan review.
- Keep changes scoped to warning source.

## Open Questions (owner, due)

- Where is the warning triggered (server vs client)? Likely `hooks/useSupabaseSession.tsx` (owner: github:@amankumarshrestha, due: 2026-01-01)
- Any intentional reliance on `getSession().user` for performance? (owner: github:@amankumarshrestha, due: 2026-01-01)

## Recommended Direction (with rationale)

- Identify the code path(s) using `getSession()` or `onAuthStateChange()` user object, and replace with `getUser()` where authentication assurance is required to suppress warning.

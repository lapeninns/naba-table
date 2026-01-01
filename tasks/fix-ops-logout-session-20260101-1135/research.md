---
task: fix-ops-logout-session
timestamp_utc: 2026-01-01T11:35:15Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Ops logout keeps session

## Requirements

- Functional:
  - Ops logout should fully terminate the session so the user does not get re-authenticated on refresh.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Security: clear server-side auth cookies (httpOnly) and client auth state.

## Existing Patterns & Reuse

- `components/layout/Header/Header.tsx` uses `/api/auth/signout` to clear httpOnly cookies, then calls `supabase.auth.signOut()`.
- `lib/supabase/signOut.ts` only calls client `supabase.auth.signOut()`.
- Ops sidebar logout (`src/components/features/ops-shell/OpsSidebarLayout.tsx`) uses `signOutFromSupabase()` and likely leaves server cookies intact.

## External Resources

- None.

## Constraints & Risks

- Must follow AGENTS SDLC phases with task artifacts.
- Likely UI change (logout behavior) → requires Chrome DevTools MCP manual QA.

## Open Questions (owner, due)

- Does customer-facing logout also require server signout to avoid the same issue? (owner: github:@amankumarshrestha)

## Recommended Direction (with rationale)

- Align ops logout with Header pattern by calling `/api/auth/signout` before client sign-out to clear httpOnly cookies and avoid re-login on refresh.

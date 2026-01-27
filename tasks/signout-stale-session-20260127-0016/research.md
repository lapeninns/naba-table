---
task: signout-stale-session
timestamp_utc: 2026-01-27T00:16:44Z
owner: github:@copilot
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Sign-out Requires Reload to Take Effect

## Requirements

- Functional:
- Sign-out should immediately transition the UI to signed-out state without requiring a reload.
- Sign-out should succeed even when the Supabase session is already missing/invalid.
- Non-functional (a11y, perf, security, privacy, i18n):
- Fail fast but treat already-signed-out states as success.
- Preserve secure cookie handling and avoid leaving auth cookies behind.

## Existing Patterns & Reuse

- Canonical server sign-out route: `src/app/api/auth/signout/route.ts`.
- Canonical client sign-out helper: `lib/supabase/signOut.ts`.
- Sign-out triggers:
- Guest nav: `src/components/layouts/GuestNavbar.tsx` (soft redirect + query cache clear).
- Ops nav: `src/components/features/ops-shell/OpsSidebarLayout.tsx` (hard redirect).

## External Resources

- N/A (codebase-local investigation).

## Constraints & Risks

- Supabase is remote-only; no local migrations.
- Root cause may be missing-session errors returning 500 or throwing on client.
- Must keep canonical sign-out flow in the primary path.

## Findings

- Production logs show `/api/auth/signout` returning 500 with: `Auth session missing!`.
- Server route currently returns 500 on any `supabase.auth.signOut()` error.
- Client helper throws on sign-out errors, which can block the redirect and leave stale UI state.

## Recommended Direction (with rationale)

- Treat `Auth session missing` / `session missing` sign-out errors as success.
- Always clear auth cookies server-side even when Supabase reports missing session.
- On the client, treat missing-session errors as success and proceed with redirect/cache clearing.

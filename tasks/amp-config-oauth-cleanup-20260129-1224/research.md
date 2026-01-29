---
task: amp-config-oauth-cleanup
timestamp_utc: 2026-01-29T12:24:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: AMP config + OAuth cleanup

## Request

- Fix the AMP config.
- Delete the current OAuth.

## Existing Patterns & Reuse

- Next.js config: `next.config.js`.
- Auth is Supabase-based; sign-in endpoints: `src/app/api/auth/signin/route.ts`, callback: `src/app/api/auth/callback/route.ts`.

## Findings

- AMP: No explicit AMP configuration found in repo (no `amp:`, `next/amp`, `amphtml`, `ampproject`, or `amplitude` references).
- OAuth: No provider configuration found (no `next-auth` package usage, no `signInWithOAuth` calls).
- OAuth/implicit-flow remnants found (now removed):
  - `components/auth/ImplicitAuthHandler.tsx` (URL hash tokens `#access_token=...`).
  - `components/LayoutClient.tsx`, `src/components/layouts/AuthLayout.tsx`, `src/components/layouts/EnhancedAuthLayout.tsx` mounted the handler.
  - Docs labeled `/api/auth/callback` as "OAuth callback".
  - `types/next-auth.d.ts` existed but no code imports NextAuth.

## Risks

- Removing the implicit hash handler could break legacy flows if any links still return `#access_token` fragments.

## Open Questions (owner, due)

- Q: What is meant by "AMP config" in this repo (Next.js AMP mode vs another integration named amp)?
  A: UNCONFIRMED.

## Additional Evidence (search)

- No `amp`/`AMP` hits in `next.config.js` or `package.json`.
- No `amp`/`AMP` hits in `.github/**`, `scripts/**`, or `.env.example`.

## Recommended Direction

- Remove unused OAuth remnants (NextAuth type stub; docs references; optional removal of implicit hash handler if you confirm it is not needed).
- Clarify what "AMP config" refers to before changing any config.

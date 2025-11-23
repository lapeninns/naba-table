---
task: supabase-magic-link-issue
timestamp_utc: 2025-11-22T23:25:14Z
owner: github:@assistant
reviewers: [github:@assistant]
risk: medium
flags: []
related_tickets: []
---

# Research: Supabase magic link not working (Ops login)

## Requirements

- Functional: magic link sign-in from `/app/login` (operations console) must send link and successfully authenticate/redirect back to the requested app path (e.g., `/app`).
- Non-functional: avoid 404s from analytics (/api/v1/events) and align redirect origins with Supabase callback allowlist.

## Existing Patterns & Reuse

- `components/auth/SignInForm` handles magic link via `supabase.auth.signInWithOtp` with `emailRedirectTo` pointing to `/api/auth/callback` plus `redirectedFrom`.
- `/app/login` uses `SignInForm` and redirects authenticated users to the provided `redirectedFrom` (default `/`).
- Supabase callback route at `src/app/api/auth/callback/route.ts` exchanges code and redirects.
- Analytics emitter posts to `/api/v1/events` but no route exists (returns 404).

## External Resources

- Supabase Next.js SSR docs for magic link callbacks.
- Supabase dashboard → Authentication → URL Configuration (needs http://localhost:3000 and deployed domains for magic links).

## Constraints & Risks

- Supabase magic links only allow whitelisted redirect URLs; dev port must be 3000 (ensure-dev-port enforces).
- Missing `/api/v1/events` endpoint currently 404s; may be noise but not root cause of auth failure.
- Must keep accessibility and avoid breaking password sign-in.

## Open Questions (owner, due)

- Are magic link emails delivered? (assistant, before fix)
- Does Supabase auth callback run (any errors/exceptions)? (assistant, before fix)
- Is redirect origin matching Supabase allowed URLs (prod/staging)? (assistant, before fix)

## Recommended Direction (with rationale)

- Add minimal `/api/v1/events` endpoint returning 204 to stop 404 noise (if still needed).
- Validate magic link flow end-to-end locally on port 3000; inspect callback response and Supabase logs to identify failure point (likely redirect allowlist or session exchange error).

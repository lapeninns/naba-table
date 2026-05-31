# [MEDIUM] Password signup callback URL trusts the request origin

**File:** [`src/app/api/auth/signup/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/src/app/api/auth/signup/route.ts#L47-L125) (lines 47, 48, 125)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `unsafe-redirect`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The password signup path builds Supabase's emailRedirectTo with buildCallbackUrl(req.nextUrl.origin, redirectedFrom) and passes it directly into supabase.auth.signUp. Unlike the signin route and the magic-link signup helper, this path does not resolve the host against NEXT_PUBLIC_ROOT_DOMAIN or normalize the callback origin. If a forged Host/request URL reaches the app and the resulting URL is accepted by Supabase redirect configuration, the confirmation flow can be sent to an attacker-controlled /api/auth/callback endpoint, exposing the auth callback code/token or enabling account pre-hijacking flows.

## Recommendation

Build the password signup callback with the same trusted-host logic used by signin, or validate req.nextUrl.origin with normalizeTrustedMagicLinkRedirect/resolveTrustedAuthHostname before passing it to Supabase. Reject untrusted hosts instead of relying on provider-side allowlists.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-19)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-12)

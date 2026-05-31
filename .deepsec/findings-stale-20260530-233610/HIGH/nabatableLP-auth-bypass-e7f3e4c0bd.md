# [HIGH] Magic-link callback URL is built from attacker-controlled host data

**File:** [`src/app/api/auth/signin/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/auth/signin/route.ts#L85-L384) (lines 85, 86, 88, 95, 99, 100, 175, 373, 384)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** medium • **Slug:** `auth-bypass`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

POST resolves the hostname from request headers, then buildCallbackUrl accepts any hostname containing localhost or ending in nabatable.com, such as localhost.attacker.com or evilnabatable.com, and passes the result as emailRedirectTo to sendAuthMagicLink. Because sendAuthMagicLink appends the Supabase token_hash to that URL, a request with spoofed Host, X-Forwarded-Host, or Origin can cause a victim's magic-link email to point at an attacker-controlled origin if the deployment/proxy accepts that host and Supabase redirect allowlisting does not reject it. Clicking the email leaks the one-time token to the attacker, who can redeem it at the real callback.

## Recommendation

Do not derive auth callback origins from request headers. Choose the callback origin from a server-side allowlist keyed by the real surface, require exact hosts such as app/root/www for NEXT_PUBLIC_ROOT_DOMAIN, and reject unknown hosts. Avoid substring checks such as includes('localhost') and endsWith('nabatable.com').

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-23)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-19)

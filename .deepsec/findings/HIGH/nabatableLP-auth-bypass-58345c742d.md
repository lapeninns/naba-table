# [HIGH] Magic-link callback host can be poisoned to leak login tokens

**File:** [`src/app/api/auth/signin/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/auth/signin/route.ts#L85-L384) (lines 85, 86, 88, 99, 100, 175, 373, 384)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** medium • **Slug:** `auth-bypass`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The route derives hostname from request headers via parseHostname() and then buildCallbackUrl() accepts any hostname ending with the literal string "nabatable.com". A registrable attacker domain such as evil-nabatable.com satisfies that suffix check. For a known email, the handler passes the resulting emailRedirectTo into sendAuthMagicLink(); the magic-link helper constructs a callback URL containing the token_hash on that host. An attacker who can POST with spoofed forwarded/host headers can cause the victim email to receive a link to the attacker-controlled domain and capture the token_hash, then verify it to obtain a session. CSRF does not protect this public endpoint from a direct attacker client because the double-submit cookie/header can be obtained and replayed by that client. Turnstile may reduce exploitability for the public_guest surface when configured correctly, but callback host validation should not depend on optional CAPTCHA configuration.

## Recommendation

Do not trust forwarded/origin/referer host headers from the request for auth callback generation. Build the callback host from configured allowed hosts/rootDomain, require exact host or dot-boundary subdomain checks, and reject values like evil-nabatable.com. Reuse the existing allowedHosts-style logic for callback URLs.

## Revalidation

**Verdict:** true-positive

The current signin route still derives hostname from parseHostname(req), and parseHostname prioritizes x-forwarded-host, x-original-host, origin, referer, and host before req.nextUrl. buildCallbackUrl then accepts any hostname that includes localhost or endsWith the literal string nabatable.com. That suffix check accepts attacker-controlled registrable domains such as evil-nabatable.com and evilnabatable.com. For a known email with a profile and user_profile row, POST calls sendAuthMagicLink with emailRedirectTo built from that poisoned hostname. sendAuthMagicLink obtains a Supabase hashed_token and constructs the emailed link by appending token_hash and type=magiclink to emailRedirectTo, so the official email can point at the attacker-controlled host. A concrete attack is: obtain a CSRF cookie/header pair from the public app, POST mode=magic_link for the victim email with x-forwarded-host: evil-nabatable.com, wait for the victim to click the official magic-link email, capture token_hash on the attacker host, and redeem it against the real callback route to receive Nabatable session cookies. src/proxy.ts does not strip or normalize x-forwarded-host for shared /api/auth/signin requests, so there is no application-level mitigation before the route. Turnstile can add friction for public_guest traffic, but it is optional and is not a host allowlist.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-23)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-19)

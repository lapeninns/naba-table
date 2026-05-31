# [MEDIUM] Production Supabase auth cookies can be set without Secure

**File:** [`server/supabase.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/supabase.ts#L67-L92) (lines 67, 71, 72, 88, 90, 92)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `other-insecure-cookie`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

Supabase server cookie defaults compute `secureCookies` as `env.node.appEnv !== "development" && COOKIE_DOMAIN !== undefined`. If NEXT_PUBLIC_ROOT_DOMAIN is unset or resolves to localhost/host-only cookies in a production-like deployment, COOKIE_DOMAIN is undefined and auth cookies are written with `secure: false`. The Secure attribute should not depend on whether a Domain attribute is present; otherwise session cookies may be sent over plain HTTP if the deployment accepts or is downgraded to HTTP.

## Recommendation

Set Secure based on runtime protocol or production environment, independent of COOKIE_DOMAIN. Require a valid production root domain during env validation if cross-subdomain cookies are required, and add/verify HSTS at the edge.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-21)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-24)

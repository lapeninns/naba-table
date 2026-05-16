# [MEDIUM] Auth callback logs one-time login credentials in the full URL

**File:** [`src/app/api/auth/callback/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/auth/callback/route.ts#L118-L261) (lines 118, 119, 125, 130, 205, 261)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `secret-in-log`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The callback reads code and token_hash from the query string, then logs req.url as fullUrl before exchanging or verifying those values. That full URL contains the Supabase OAuth/PKCE code or magic-link token hash. Any centralized log sink or support/debug log access can receive login material during its validity window and potentially race or replay unused callback credentials.

## Recommendation

Never log the raw callback URL or query string. Log only booleans/request IDs, or explicitly redact code, token_hash, access tokens, and other auth parameters before writing diagnostics.

## Revalidation

**Verdict:** fixed

The current callback route does not log req.url or a fullUrl field. It defines SENSITIVE_CALLBACK_PARAMS with code, token_hash, access_token, refresh_token, and redirectedFrom, then logs callbackUrl: redactCallbackUrl(req.url). That helper replaces sensitive query parameter values with [redacted] before logging. The route also logs redirectedFrom via describeRedirectTarget, which records only none, relative, invalid, or an absolute hostname rather than the raw value. Header logging was changed to booleans like hasReferer and hasForwardedHost, so referer/origin query strings are not written either. I traced both the code exchange and token_hash verification branches and found logs for success/failure metadata, but not the raw code or token_hash. tests/server/auth/callback-route-security.test.ts asserts that token_hash, access_token, refresh_token, referer secrets, and raw redirectedFrom values are absent from log output. Commit 020a7389 replaced fullUrl: req.url with the redacted logging flow.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-15)

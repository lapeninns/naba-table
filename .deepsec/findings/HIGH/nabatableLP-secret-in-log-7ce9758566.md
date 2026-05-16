# [HIGH] Auth callback logs magic-link token hashes and OAuth codes

**File:** [`src/app/api/auth/callback/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/auth/callback/route.ts#L117-L130) (lines 117, 118, 119, 125, 130)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `secret-in-log`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The callback extracts code and token_hash from the request URL, then logs fullUrl: req.url before exchanging or verifying the token. For magic-link flows, the token_hash is embedded directly in the callback URL, and OAuth/PKCE callbacks include the authorization code. Sending those values to application logs exposes login credentials to log readers and log-processing systems; in some failure or race cases they can be replayed to establish a session.

## Recommendation

Never log full callback URLs. Log only non-sensitive metadata such as path, host, and booleans, or explicitly redact code, token_hash, access_token, refresh_token, and similar parameters before logging. Add a regression test for auth callback log redaction.

## Revalidation

**Verdict:** fixed

The finding matched the older code, but the current route has explicit redaction before diagnostics. GET extracts code and tokenHash for Supabase exchange/verify calls, but the initial log records only hasCode and callbackUrl after redactCallbackUrl has replaced code and token_hash. The same redaction covers access_token and refresh_token, and redirectedFrom is summarized rather than logged raw. Subsequent logs say 'Attempting to exchange code' and 'Verifying token_hash' without including credential values. Error logs include Supabase error message/status/code/name, not the one-time credential. The callback route now derives hostname from requestUrl.hostname rather than parseHostname, which also prevents forged forwarded headers from influencing callback redirect origins in this route. The regression test constructs a URL containing token_hash=secret-token and verifies the secret does not appear in log output. This was fixed in commit 020a7389.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-15)

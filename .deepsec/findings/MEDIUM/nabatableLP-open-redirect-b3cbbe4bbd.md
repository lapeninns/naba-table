# [MEDIUM] Callback redirects trust forwarded host and stored absolute return paths

**File:** [`src/app/api/ops/google-business-profile/callback/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/google-business-profile/callback/route.ts#L11-L45) (lines 11, 12, 43, 45)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `open-redirect`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

Redirect targets are built from getRequestOrigin(req), which trusts x-forwarded-host/host without an allowlist, and successful callbacks redirect to result.returnPath from the OAuth state without sanitizeRedirect-style validation. If the deployment path lets clients influence forwarded host headers, error callbacks or stored return paths can become redirects to an attacker-controlled origin.

## Recommendation

Use a configured trusted app origin for this OAuth flow, store relative return paths, and validate any stored or computed redirect target against the known root/app host allowlist before calling NextResponse.redirect.

## Revalidation

**Verdict:** true-positive

The current callback trusts both the request-derived origin and the stored returnPath. getRequestOrigin reads x-forwarded-host and Host without validating them against an application host allowlist. On successful authorization, new URL(result.returnPath || DEFAULT_RETURN_PATH, getRequestOrigin(req)) will preserve an absolute result.returnPath origin instead of forcing a relative app path. The state return_path is created by connect routes as an absolute URL using the same unvalidated origin helper, so a spoofed forwarded host at initiation can persist into the later callback redirect. The error path has the same request-origin issue through buildRedirect. I found sanitizeRedirect in the auth code, but it is not used by this Google Business Profile callback.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-23)

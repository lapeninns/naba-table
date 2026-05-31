# [MEDIUM] Legacy sync route bypasses password confirmation used by the current GBP sync endpoint

**File:** [`src/app/api/ops/restaurants/[id]/google-business/sync/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/[id]/google-business/sync/route.ts#L16-L23) (lines 16, 23)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `auth-bypass`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The current google-business-profile POST route requires a password confirmation before calling the same syncGoogleBusinessProfileBusinessInformation service, but this legacy google-business sync route exposes the sync with only ambient session admin auth. If this legacy route remains reachable, an attacker with an admin session, including via CSRF, can bypass the intended step-up confirmation for manual GBP sync.

## Recommendation

Remove or block the legacy route, or enforce the same password-confirmation, CSRF, and rate-limit checks as the current Google Business Profile sync endpoint.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-28)

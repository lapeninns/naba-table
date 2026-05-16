# [MEDIUM] OAuth return path is stored and replayed without origin validation

**File:** [`server/google-business-profile/service.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/google-business-profile/service.ts#L287-L930) (lines 287, 297, 930)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `open-redirect`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

createOAuthStateRecord persists the caller-supplied returnPath directly into restaurant_external_profile_oauth_states, and completeGoogleBusinessProfileAuthorization later returns that stored value to the callback route. The current connect routes build that returnPath from the request origin, which is derived from forwarded host headers in related code. If a request can poison the host/forwarded-host used when starting OAuth, the stored absolute returnPath can point at an attacker-controlled origin and the successful callback will redirect there.

## Recommendation

Store only relative app paths for OAuth return destinations, or validate absolute returnPath values against a configured app/root host allowlist before insert and again before redirecting.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)

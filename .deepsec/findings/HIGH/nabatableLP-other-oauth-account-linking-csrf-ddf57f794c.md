# [HIGH] OAuth callback is not bound to the initiating app session

**File:** [`src/app/api/ops/google-business-profile/callback/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/google-business-profile/callback/route.ts#L20-L38) (lines 20, 38)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `other-oauth-account-linking-csrf`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The public callback accepts only state and code, then completes Google authorization with the service-role flow. The OAuth state row records requested_by_user_id when created, but this route never authenticates the current Supabase user or verifies that the callback is running in the same user/session that initiated the flow. A malicious restaurant admin can generate a Google authorization URL for their own restaurant and trick another Google Business Profile owner into granting consent; the victim's Google refresh token is then stored on the attacker's restaurant external profile.

## Recommendation

Authenticate the callback with the cookie-bound Supabase user before exchanging the code. Verify the state belongs to that user, verify the user still has admin membership for the state restaurant_id, and bind the state to an httpOnly nonce/session cookie. Reject before consuming the state or exchanging the Google code when those checks fail.

## Revalidation

**Verdict:** true-positive

The public callback reads state and code and calls completeGoogleBusinessProfileAuthorization without authenticating the current Supabase user. The OAuth state row stores requested_by_user_id when created, but consumeOAuthStateRecord and completeGoogleBusinessProfileAuthorization never compare that value to a current session. There is also no httpOnly nonce cookie binding the state to the browser that initiated the flow. A malicious restaurant admin can create a valid authorization URL for their own restaurant and send that Google URL to a victim who controls a Google Business Profile. If the victim consents, the callback exchanges the code with service-role logic and stores the victim's Google refresh token on the attacker's restaurant external profile. State randomness does not mitigate this because the attacker is using a legitimate state token they created.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-23)

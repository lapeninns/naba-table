# [MEDIUM] Invite bearer tokens are exposed through analytics-visible URLs

**File:** [`server/team/invitations.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/server/team/invitations.ts#L70-L244) (lines 70, 78, 94, 122, 244)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-token-leak`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The invite flow creates a raw bearer token and stores only its hash, then passes the raw token into the email path. findInviteByToken later treats that URL token as the lookup secret. Tracing the related email and pageview code shows the token is embedded in /invite/<token>, while global client analytics captures the full current URL for pageviews. A recipient opening an invite therefore sends the token-bearing path to analytics providers/logs. Anyone with analytics or vendor log access can use the token against the public invite lookup endpoint to disclose the invite email, role, restaurant, status, and expiry; accepting still requires an authenticated matching email, so this is token/PII exposure rather than standalone account takeover.

## Recommendation

Keep invite secrets out of analytics-visible URLs. Redact or suppress /invite/<token> in pageview/error telemetry, disable third-party analytics on invite routes, or immediately exchange the token into an HttpOnly SameSite cookie and redirect to a tokenless path before rendering the invite UI.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-19)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-10-26)

# [BUG] Invite links prefer the app host for a public invite route

**File:** [`lib/owner/team/invite-links.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/lib/owner/team/invite-links.ts#L5-L6) (lines 5, 6)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** medium • **Slug:** `other-broken-invite-link`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

buildInviteUrl() builds /invite/{token} from env.app.url, and env.app.url prefers NEXT_PUBLIC_APP_URL over NEXT_PUBLIC_SITE_URL. In the documented split-host deployment, /invite/[token] is a public/root-host route, while app-host non-API, non-auth paths are treated by the proxy as ops pages and rewritten under /app with authentication. If NEXT_PUBLIC_APP_URL is the app host, invitation emails point invitees at the wrong surface and the acceptance page can be unreachable or routed through ops auth instead of the public invite page. The scanner's secret-in-log signal is a false positive: this file does not log the token.

## Recommendation

Build invite URLs from the trusted public site origin, e.g. getTrustedSiteOrigin() or NEXT_PUBLIC_SITE_URL, and encode the token path segment. Add a regression test where NEXT_PUBLIC_APP_URL is app.nabatable.com and NEXT_PUBLIC_SITE_URL is www.nabatable.com.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-19)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-11-09)

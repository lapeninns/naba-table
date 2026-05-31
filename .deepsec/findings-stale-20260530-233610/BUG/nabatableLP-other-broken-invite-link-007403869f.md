# [BUG] Team invitation emails can use the app host for a root-host invite route

**File:** [`server/emails/invitations.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/server/emails/invitations.ts#L49) (lines 49)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** medium • **Slug:** `other-broken-invite-link`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

sendTeamInviteEmail builds the acceptance link with buildInviteUrl(token). That helper uses `env.app.url`, and `env.app.url` prefers NEXT_PUBLIC_APP_URL over NEXT_PUBLIC_SITE_URL, while the shipped invite page is `src/app/(public)/invite/[token]/page.tsx` on the public/root surface. In split-host deployments where NEXT_PUBLIC_APP_URL is the app host, `/invite/<token>` is treated by the proxy as an ops page, rewritten under `/app`, and protected by ops auth, so recipients can receive a sign-in/404 path instead of the public invite acceptance flow.

## Recommendation

Generate invite links with the public/root origin, such as `getTrustedSiteOrigin()`, or introduce a dedicated public invite URL helper. Keep the raw fallback anchor escaped as defense in depth.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-11)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-05)

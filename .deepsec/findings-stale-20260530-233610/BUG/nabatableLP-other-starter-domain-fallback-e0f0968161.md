# [BUG] Sitemap metadata falls back to starter domain

**File:** [`src/app/sitemap.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/src/app/sitemap.ts#L3-L13) (lines 3, 4, 5, 6, 13)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-starter-domain-fallback`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

If neither NEXT_PUBLIC_SITE_URL nor SITE_URL is set, sitemap() emits every listed route under https://shipfa.st. This is not attacker-controlled and is not an open redirect, but it is a real production metadata bug: crawlers would receive Nabatable route paths on an unrelated starter-template host.

## Recommendation

Use the Nabatable canonical origin fallback, such as https://www.nabatable.com or a shared trusted site URL helper, and keep this behavior aligned with next-sitemap.config.js.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-24)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-05)

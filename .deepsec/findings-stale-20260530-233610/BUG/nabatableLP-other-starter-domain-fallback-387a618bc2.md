# [BUG] Robots metadata falls back to starter domain

**File:** [`src/app/robots.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/src/app/robots.ts#L3-L17) (lines 3, 4, 5, 6, 17)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-starter-domain-fallback`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

If neither NEXT_PUBLIC_SITE_URL nor SITE_URL is set, robots() emits a sitemap URL under https://shipfa.st. That is a starter-template domain and is inconsistent with the Nabatable canonical domain used elsewhere, including next-sitemap.config.js. In a production or preview deployment with missing URL env, crawlers would be directed to a third-party sitemap origin.

## Recommendation

Use the Nabatable canonical origin fallback, such as https://www.nabatable.com or a shared trusted site URL helper, and consider validating the configured origin before emitting metadata.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-11-19)

# [BUG] Sitemap generation can fall back to the starter template domain

**File:** [`next-sitemap.config.js`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/next-sitemap.config.js#L3) (lines 3)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** medium • **Slug:** `other-stale-sitemap-domain`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The sitemap config uses only SITE_URL and otherwise falls back to https://shipfa.st. The production environment schema requires NEXT_PUBLIC_SITE_URL, not SITE_URL, so a normal production environment with NEXT_PUBLIC_SITE_URL set but SITE_URL unset would generate sitemap URLs for the unrelated starter domain if this config is used.

## Recommendation

Use NEXT_PUBLIC_SITE_URL before SITE_URL and fail generation when neither is set, rather than falling back to an unrelated domain.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-06)
- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2025-09-04)

**Verdict:** fixed

`next-sitemap.config.js` now resolves `siteUrl` from `NEXT_PUBLIC_SITE_URL`,
then `SITE_URL`, then the Nabatable canonical fallback
`https://www.nabatable.com`. It no longer references the starter template host.

Evidence:

- `tests/config/link-config.test.ts` verifies `NEXT_PUBLIC_SITE_URL` precedence
  and the Nabatable fallback when no env var is set.
- `pnpm exec vitest run tests/config/link-config.test.ts`

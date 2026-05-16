# [BUG] Sitemap config falls back to the starter template domain

**File:** [`next-sitemap.config.js`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/next-sitemap.config.js#L3) (lines 3)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-wrong-canonical-domain`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

`siteUrl` falls back to `https://shipfa.st`, which is unrelated to Nabatable. If `next-sitemap` is run without `SITE_URL`, generated sitemap or robots artifacts will advertise the wrong canonical host. The production env schema requires `NEXT_PUBLIC_SITE_URL`, not `SITE_URL`, so this config can still miss the canonical URL even in an otherwise valid environment.

## Recommendation

Use `process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || 'https://nabatable.com'`, or fail generation when no canonical site URL is configured.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-06)
- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2025-09-04)

**Verdict:** fixed

`next-sitemap.config.js` no longer falls back to `https://shipfa.st`; sitemap
generation now prefers `NEXT_PUBLIC_SITE_URL`, then `SITE_URL`, then
`https://www.nabatable.com`.

Evidence:

- `tests/config/link-config.test.ts` verifies canonical host precedence and
  fallback behavior.
- `pnpm exec vitest run tests/config/link-config.test.ts`

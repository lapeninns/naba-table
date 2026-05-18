# [HIGH] Restaurant creation can seed public pages with unsafe map URLs

**File:** [`server/restaurants/create.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/restaurants/create.ts#L172-L175) (lines 172, 173, 175)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `xss`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

createRestaurant writes googleMapUrl/googleReviewUrl/logoUrl directly from input into the restaurants row. The create route validation uses z.string().url(), which accepts javascript: and data: schemes. Created restaurants are active by default, and the public restaurant page uses googleMapUrl directly as an anchor href, enabling stored XSS when a guest clicks Open map.

## Recommendation

Validate URL schemes server-side before insertion, allowing only http: and https: or a stricter Google-host allowlist for map/review URLs. Keep this validation in the shared create/update schemas so all callers get the same protection.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-11)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-08)

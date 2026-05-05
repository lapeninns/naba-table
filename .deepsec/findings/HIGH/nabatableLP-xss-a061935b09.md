# [HIGH] Restaurant profile update stores unsafe URL schemes used as public links

**File:** [`src/app/api/ops/restaurants/[id]/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/[id]/route.ts#L210-L235) (lines 210, 234, 235)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `xss`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

PATCH parses the request with updateRestaurantSchema and then persists googleMapUrl/googleReviewUrl into the restaurant profile. That imported schema uses generic z.string().url(), which accepts javascript: and data: schemes. The public restaurant detail page uses googleMapUrl directly as an anchor href for the Open map link, making this a stored XSS vector against guests who click the link.

## Recommendation

Validate these fields with a shared safe URL helper that requires http: or https:, and use a stricter host allowlist for Google Maps/review URLs. Reject or neutralize any non-web URL scheme before persistence.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-29)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-08)

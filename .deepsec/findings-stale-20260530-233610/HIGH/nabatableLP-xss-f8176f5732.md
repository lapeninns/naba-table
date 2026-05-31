# [HIGH] URL validation accepts javascript and data schemes

**File:** [`components/ops/restaurants/restaurantDetailsFormModel.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/components/ops/restaurants/restaurantDetailsFormModel.ts#L313-L425) (lines 313, 314, 413, 416, 422, 425)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `xss`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

validateRestaurantDetails treats new URL(...) as sufficient validation for googleReviewUrl and googleMapUrl, and sanitizePayload returns the trimmed values unchanged. new URL(...) accepts javascript: and data: URLs, and the API schema uses z.string().url(), which also accepts those schemes. Because these values are persisted and later rendered as href values on public pages and email CTAs, this enables stored JavaScript URL injection.

## Recommendation

Replace parseability-only checks with a canonical safe URL validator that requires https: and optionally restricts the hostname to approved Google domains. Reuse that validator in the client model and API schemas before storing the values.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-01)

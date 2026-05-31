# [HIGH] Restaurant update endpoint stores unsafe public link schemes

**File:** [`src/app/api/ops/restaurants/[id]/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/[id]/route.ts#L20-L235) (lines 20, 210, 234, 235)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `xss`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

PATCH validates with the imported updateRestaurantSchema and then stores googleMapUrl and googleReviewUrl directly. That schema uses generic URL validation, which accepts javascript: and data: schemes. The stored googleMapUrl is rendered as a public anchor href in the restaurant detail page, creating stored/interaction XSS when a guest or staff member clicks the link.

## Recommendation

Use a shared URL schema that only permits http: and https:, with stricter domain allowlists for Google Maps/review URLs where possible. Sanitize existing stored values before rendering.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-29)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-08)

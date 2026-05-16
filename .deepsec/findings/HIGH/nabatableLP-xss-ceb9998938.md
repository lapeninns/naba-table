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

## Revalidation

**Verdict:** fixed

The map and review URL parts of this finding are fixed in the current code. createRestaurant normalizes googleMapUrl and googleReviewUrl with the shared safe Google URL helpers before insert, and the route schema now requires the same canonical safe value. The public restaurant detail page does not trust the stored value blindly; getRestaurantBySlug sanitizes google_map_url and PublicSections.getMapsHref sanitizes it again before assigning the anchor href. Invalid or non-Google schemes therefore become null and the UI falls back to a generated Google Maps search URL. logoUrl is still accepted as a generic absolute URL, but the traced public use is as an image source, not the Open map anchor href described by the finding. The stored public map-link XSS path was patched by 020a7389.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-08)

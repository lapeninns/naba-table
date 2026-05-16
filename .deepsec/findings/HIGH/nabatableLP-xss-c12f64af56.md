# [HIGH] Restaurant creation can seed unsafe public map URLs

**File:** [`server/restaurants/create.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/restaurants/create.ts#L172) (lines 172)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `xss`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

createRestaurant() persists input.googleMapUrl directly into google_map_url. The create route schemas rely on generic URL validation, which accepts javascript: and data: schemes. Once the restaurant is active, the public restaurant detail page renders this stored value as the Open map anchor href, creating a stored click-triggered XSS path for guests.

## Recommendation

Validate public URL fields before insert with a scheme and hostname allowlist. At minimum, reject non-http(s) protocols in createRestaurant() so all creation paths share the same protection.

## Revalidation

**Verdict:** fixed

The current create path no longer persists the map URL directly. createRestaurant calls safeGoogleMapsUrl and safeGoogleReviewUrl before building the insert payload, and the stored google_map_url now receives the sanitized value rather than raw input. The helper rejects javascript:, data:, file:, blob:, non-HTTPS URLs, and non-Google hosts. The ops/onboarding create schema also uses the same sanitizer/refinement instead of a generic z.string().url() for map and review URLs. The public detail path sanitizes again in getRestaurantBySlug and PublicSections.getMapsHref before rendering the Open map anchor, so legacy unsafe values fall back to a Google Maps search. Git blame shows this sanitizer change came from 020a7389, so the described stored click-triggered map XSS path is patched.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-08)

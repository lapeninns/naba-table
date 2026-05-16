# [HIGH] Restaurant profile form persists unsafe external-link schemes

**File:** [`components/ops/restaurants/RestaurantDetailsForm.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/components/ops/restaurants/RestaurantDetailsForm.tsx#L495-L1826) (lines 495, 496, 699, 737, 1305, 1782, 1826)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `xss`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The form accepts Google Maps and Google Review URLs and submits them through sanitizePayload in both the contact subform and full form. The UI uses URL inputs, but URL inputs do not restrict schemes, and the shared validation only checks parseability. A restaurant admin can save a value such as javascript:alert(1). Those persisted values are later used as public restaurant page anchors and booking email CTA destinations, so a malicious or compromised restaurant admin can create stored XSS that triggers when a guest or staff user clicks the map/review CTA.

## Recommendation

Validate these fields before submit and enforce the same rules server-side. Require https: URLs and preferably allowlist expected hosts such as Google Maps and g.page; reject javascript:, data:, vbscript:, file:, and other non-web schemes before persistence or rendering.

## Revalidation

**Verdict:** fixed

The current form no longer relies on URL input type or parseability-only checks before submit. Both the full form and contact subform call validateRestaurantDetails before sanitizePayload is submitted, and that validator now uses safeGoogleMapsUrl and safeGoogleReviewUrl from lib/security/safe-url.ts. Those helpers require https and an allowed Google/g.page/maps host, so javascript:, data:, vbscript:, file:, and arbitrary non-web schemes fail client validation. The server-side PATCH path also parses the same fields through updateRestaurantSchema in src/app/api/ops/restaurants/schema.ts, which uses the same safe URL helpers and rejects tampered requests before persistence. The lower-level restaurant update/read paths additionally normalize stored values with safeGoogleMapsUrl and safeGoogleReviewUrl, and public/email consumers sanitize legacy stored values before creating hrefs. The small unsaved 'Open map/review link' controls in the form only allow http/https via getHttpUrl and do not persist or expose values to guests. This was a valid class of issue historically, but the current code has the necessary client, server, and render-time mitigations.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-09)

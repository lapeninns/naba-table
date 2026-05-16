# [MEDIUM] Restaurant Google link fields submit arbitrary external URLs

**File:** [`components/ops/restaurants/RestaurantDetailsForm.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/components/ops/restaurants/RestaurantDetailsForm.tsx#L495-L1821) (lines 495, 496, 695, 733, 1777, 1821)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-unsafe-external-url`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The contact/location subform submits googleMapUrl and googleReviewUrl directly from sanitizePayload into the restaurant profile. The visible type="url" inputs do not restrict protocol or host, and the shared model/API validation only checks URL syntax. These stored values are later used on guest-facing map/review surfaces and booking email CTAs, so a malicious or compromised restaurant admin can place a non-Google phishing URL into trusted Nabatable guest flows.

## Recommendation

Use a shared URL validator before submit and on the server that requires https and an allowlist of expected Google Maps/review hosts. Reject or clear existing nonconforming stored values before rendering public links or email CTAs.

## Revalidation

**Verdict:** fixed

The current submit path is no longer an arbitrary external URL sink. RestaurantDetailsForm and ContactLocationSubform both validate googleMapUrl and googleReviewUrl through validateRestaurantDetails before calling sanitizePayload, and the validator requires safeGoogleMapsUrl or safeGoogleReviewUrl to accept the value. The shared safe-url helper requires https and Google/g.page/maps.app.goo.gl-style hosts, so a direct phishing URL such as https://evil.example is rejected. A forged request cannot bypass this by skipping the browser because updateRestaurantSchema and the details route schemas apply the same sanitizer/refinement server-side. The service layer also stores safeGoogleMapsUrl/safeGoogleReviewUrl output and public page/email readers sanitize stored links again. Therefore the specific persisted non-Google external-link attack described in the finding is patched in the current code.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-09)

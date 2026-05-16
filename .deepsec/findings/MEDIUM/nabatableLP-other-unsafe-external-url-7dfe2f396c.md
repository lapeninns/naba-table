# [MEDIUM] URL validation accepts unsafe schemes and non-Google destinations

**File:** [`components/ops/restaurants/restaurantDetailsFormModel.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/components/ops/restaurants/restaurantDetailsFormModel.ts#L313-L425) (lines 313, 314, 413, 416, 422, 425)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-unsafe-external-url`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

validateRestaurantDetails treats new URL(...) as sufficient validation for googleReviewUrl and googleMapUrl, and sanitizePayload preserves the trimmed values unchanged. WHATWG URL parsing accepts schemes such as javascript: and data:, as well as arbitrary https hosts. The server schemas traced from this form also use z.string().url(), so tampered requests can persist these values even if client validation is improved.

## Recommendation

Replace syntax-only URL checks with a shared safeGoogleUrl parser that requires https and approved Google Maps/review hostnames. Apply the same parser in the client model and API schemas, and normalize or reject unsafe stored values before use.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-01)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.

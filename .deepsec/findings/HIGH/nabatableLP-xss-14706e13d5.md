# [HIGH] Stored unsafe URL can execute from the public map link

**File:** [`src/components/restaurants/PublicSections.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/components/restaurants/PublicSections.tsx#L67-L485) (lines 67, 68, 485)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `xss`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

getMapsHref returns restaurant.googleMapUrl directly and RestaurantDetailPage renders it as an href on the public 'Open map' anchor. The write-side validation traced for googleMapUrl uses z.string().url() / new URL(), which accepts non-http schemes such as javascript:. A restaurant admin or compromised staff account can store a javascript: URL and turn the public restaurant page into a click-triggered stored XSS/phishing vector.

## Recommendation

Validate and normalize googleMapUrl on write and before render with an allowlist: require https:, and preferably restrict hosts to Google Maps domains. Fall back to the encoded maps search URL when validation fails.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-02)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.

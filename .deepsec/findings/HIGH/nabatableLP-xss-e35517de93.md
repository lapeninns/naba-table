# [HIGH] Restaurant update path persists javascript: map/review URLs

**File:** [`server/restaurants/update.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/restaurants/update.ts#L162-L169) (lines 162, 164, 167, 169)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `xss`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

updateRestaurant trims and stores googleMapUrl/googleReviewUrl without checking the URL scheme. The ops route schemas rely on z.string().url(), which accepts javascript: and data: URLs, and the public restaurant detail page renders googleMapUrl directly as the Open map href. This allows stored same-origin script execution when a guest clicks the public map link.

## Recommendation

Reject non-http(s) schemes before persisting URL fields, and use a shared URL schema in both route validation and server helpers. For map/review fields, consider allowlisting known Google Maps/review hosts.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-11)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-08)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.

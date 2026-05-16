# [HIGH] Stored URL fields allow javascript: and data: schemes

**File:** [`src/app/api/ops/restaurants/schema.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/schema.ts#L91-L176) (lines 91, 98, 169, 176)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `xss`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

googleMapUrl and googleReviewUrl are validated only with z.string().url(), which accepts javascript: and data: URLs. These stored values later become public restaurant links and email CTA destinations. An attacker with restaurant profile edit/create ability can store a javascript: URL and trigger script execution when a guest or authenticated user clicks the rendered map/review link.

## Recommendation

Replace generic .url() validation with a URL parser refinement that permits only https: and, for map/review fields, preferably an allowlist of expected Google hosts. Apply the same restriction across create, update, and details schemas before storing or rendering links.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-29)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.

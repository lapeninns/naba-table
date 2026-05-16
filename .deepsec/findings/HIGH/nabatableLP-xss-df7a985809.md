# [HIGH] Stored JavaScript URL can be rendered as the public map link

**File:** [`src/components/restaurants/PublicSections.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/components/restaurants/PublicSections.tsx#L66-L485) (lines 66, 68, 485)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `xss`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

getMapsHref returns restaurant.googleMapUrl directly and the detail page renders it as an anchor href for the public Open map link. Tracing writes shows restaurant googleMapUrl validation uses z.string().url() or new URL(), both of which accept javascript: URLs. A restaurant editor, compromised ops account, or synced profile source can persist a javascript: URL that is then served to public visitors as a clickable link.

## Recommendation

Validate and normalize googleMapUrl with an allowlist before storage and before rendering. At minimum allow only http: and https:, and preferably restrict map links to expected Google Maps hosts; otherwise fall back to the generated Google Maps search URL.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-02)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.

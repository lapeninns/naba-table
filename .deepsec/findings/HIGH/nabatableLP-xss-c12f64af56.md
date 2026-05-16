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

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-11)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-08)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.

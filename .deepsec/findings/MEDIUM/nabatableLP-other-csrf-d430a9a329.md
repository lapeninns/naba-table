# [MEDIUM] Auto-assignment confirmation does not validate the CSRF token

**File:** [`src/app/api/staff/auto/confirm/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/staff/auto/confirm/route.ts#L18-L81) (lines 18, 19, 24, 30, 37, 69, 72, 77, 81)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `other-csrf`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

POST confirms a hold and writes booking table assignments using the victim's cookie-authenticated session, but it never validates the CSRF header/cookie pair. With known hold and booking ids, a forged request from a browser context that sends staff cookies can confirm an assignment as the victim; the route then records assignedBy as user.id.

## Recommendation

Validate CSRF before parsing the body or calling confirmHold. Require application/json and add Origin/Referer checks for this state-changing staff endpoint.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-27)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.

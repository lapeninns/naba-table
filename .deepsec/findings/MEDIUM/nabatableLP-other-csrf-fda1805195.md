# [MEDIUM] Team invitation mutations do not enforce CSRF validation

**File:** [`src/app/app/(app)/settings/restaurant/team/page.tsx`](<https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/app/(app)/settings/restaurant/team/page.tsx#L11>) (lines 11)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `other-csrf`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

This page renders the team management client, which creates and revokes invitations through cookie-authenticated API requests. The /api/ops/team/invitations POST handler and invitation DELETE handler authenticate the user and check admin membership, but they do not validate the CSRF header/cookie pair. A forged same-site request from an admin browser could create an invitation, including to an attacker-controlled email, or revoke a pending invite.

## Recommendation

Require validateCsrfToken on team invitation POST and DELETE handlers before parsing input or mutating invitation state.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-17)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.

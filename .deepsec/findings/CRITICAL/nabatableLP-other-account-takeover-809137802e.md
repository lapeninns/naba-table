# [CRITICAL] Invite token disclosure enables account takeover through the accept flow

**File:** [`src/app/api/ops/team/invitations/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/team/invitations/route.ts#L23-L159) (lines 23, 25, 141, 146, 155, 158, 159)
**Project:** nabatableLP
**Severity:** CRITICAL • **Confidence:** high • **Slug:** `other-account-takeover`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The POST handler accepts an arbitrary invite email, creates an invitation, and returns both the raw token and inviteUrl to the inviter. In the related public accept endpoint, that token is sufficient to find an existing auth user by the invited email and call Supabase admin.updateUserById with the attacker-supplied password. A restaurant admin/manager can invite any existing user's email, read the token from this response, submit the accept request, reset that user's password, and take over the account.

## Recommendation

Do not return bearer invite tokens to inviters. For existing users, require the invitee to authenticate as the invited email before accepting and never reset passwords from an invite token. For new users, deliver the signup secret only to the mailbox and use a verified email or Supabase recovery/OTP flow.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-19)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.

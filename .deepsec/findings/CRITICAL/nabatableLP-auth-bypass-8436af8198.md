# [CRITICAL] Invitation acceptance can take over existing or new email accounts

**File:** [`src/app/api/team/invitations/[token]/accept/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/team/invitations/[token]/accept/route.ts#L117-L160) (lines 117, 121, 123, 124, 134, 135, 136, 152, 160)
**Project:** nabatableLP
**Severity:** CRITICAL • **Confidence:** high • **Slug:** `auth-bypass`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The public token acceptance handler treats possession of an invitation token as authority to create or modify a Supabase auth user for invite.email. For new users it calls service.auth.admin.createUser with the caller-supplied password and email_confirm: true; for existing users it calls service.auth.admin.updateUserById with the caller-supplied password and email_confirm: true. It then grants the restaurant membership. The related invite creation route returns the raw token/inviteUrl to the inviting admin, so a malicious tenant admin can invite a victim email, use the returned token, set a password, and gain a confirmed account or reset an existing account without proving mailbox ownership.

## Recommendation

Do not create confirmed users or reset existing passwords from an invite token alone. For existing users, require an authenticated session whose verified email matches the invite. For new users, deliver account setup only through an email-verified Supabase OTP/recovery flow. Stop returning bearer invite tokens to inviters, or make returned links non-credential administrative references.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-27)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.

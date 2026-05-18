# [CRITICAL] Invitation acceptance can reset an existing user's password

**File:** [`src/app/api/team/invitations/[token]/accept/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/team/invitations/[token]/accept/route.ts#L117-L160) (lines 117, 133, 134, 135, 136, 152, 160)
**Project:** nabatableLP
**Severity:** CRITICAL • **Confidence:** high • **Slug:** `auth-bypass`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The public invitation accept endpoint looks up an auth user by the invited email and, if one exists, calls service.auth.admin.updateUserById with the caller-supplied password. Possession of an invite token is treated as authority to take over that email's existing account, but the invite creation API returns the raw token/inviteUrl to restaurant admins. A malicious tenant admin can invite a victim email, use the returned token, and set the victim account password, gaining access as that user. The invite is also consumed only after these auth and membership side effects, so the operation is not atomic.

## Recommendation

Do not update passwords for existing users from invitation acceptance. For existing accounts, require the user to authenticate normally or complete an email-verified password reset flow before attaching membership. Stop returning raw invite tokens to inviters, and consume/lock the invite atomically before side effects.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-27)

# [HIGH] Invitation creation exposes bearer invite tokens to the inviter

**File:** [`server/team/invitations.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/team/invitations.ts#L109-L114) (lines 109, 114)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `privilege-escalation`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

createRestaurantInvite sends the invite email but also returns the raw invite token and inviteUrl to its caller. The production ops invitation route relays those fields in its JSON response, and the public accept route later uses a valid token to create or admin-update the invited email's Supabase Auth account password. A restaurant admin can therefore invite an arbitrary existing user's email, read the returned token from the create response, call the accept endpoint with an attacker-chosen password, and take over that user's account without controlling the recipient mailbox.

## Recommendation

Do not return raw invite tokens or invite URLs from authenticated invite-creation APIs. Only deliver the token to the invited mailbox, and change invite acceptance for existing users to require an authenticated session for the invited email or a separate email-verified password-reset/OTP flow. Avoid admin-updating an existing user's password based only on an invite token.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-10-26)

# [CRITICAL] Invite token disclosure enables account takeover through the accept flow

**File:** [`src/app/api/ops/team/invitations/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/team/invitations/route.ts#L23-L159) (lines 23, 25, 141, 146, 155, 158, 159)
**Project:** nabatableLP
**Severity:** CRITICAL • **Confidence:** high • **Slug:** `other-account-takeover`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The POST handler accepts an arbitrary invite email, creates an invitation, and returns both the raw token and inviteUrl to the inviter. In the related public accept endpoint, that token is sufficient to find an existing auth user by the invited email and call Supabase admin.updateUserById with the attacker-supplied password. A restaurant admin/manager can invite any existing user's email, read the token from this response, submit the accept request, reset that user's password, and take over the account.

## Recommendation

Do not return bearer invite tokens to inviters. For existing users, require the invitee to authenticate as the invited email before accepting and never reset passwords from an invite token. For new users, deliver the signup secret only to the mailbox and use a verified email or Supabase recovery/OTP flow.

## Revalidation

**Verdict:** fixed

The current POST handler creates an invitation but returns only serializeInvite(invite), and that serializer excludes token_hash, the raw token, and inviteUrl. createRestaurantInvite still generates a raw token, but it is passed only to sendTeamInviteEmail so the invite link is delivered to the invited mailbox. The API response contains metadata such as id, restaurantId, email, role, status, timestamps, and invitedBy, none of which are bearer acceptance credentials. The related accept route also no longer lets token possession reset or create auth accounts; it requires an authenticated user whose email matches the invite. Therefore the concrete attack of an admin inviting a victim, reading the returned token, and accepting as the victim is no longer available. The token-response behavior was removed in commit 020a7389.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-19)

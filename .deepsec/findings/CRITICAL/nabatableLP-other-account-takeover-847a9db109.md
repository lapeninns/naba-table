# [CRITICAL] Invite creator receives a bearer token that can reset existing users' passwords

**File:** [`src/app/api/ops/team/invitations/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/team/invitations/route.ts#L146-L159) (lines 146, 155, 158, 159)
**Project:** nabatableLP
**Severity:** CRITICAL • **Confidence:** high • **Slug:** `other-account-takeover`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

POST creates a restaurant invite and returns both the raw token and inviteUrl to the authenticated owner/manager. The related public accept handler looks up an existing auth user by invite email and calls admin.updateUserById with the attacker-supplied password before upserting the membership. A manager can invite any known existing user email, read the returned inviteUrl/token, call the accept endpoint, and take over that user's Supabase account across all of their restaurant memberships.

## Recommendation

Do not let invitation tokens authorize password resets for existing accounts. For existing users, require an authenticated session whose email matches the invite before accepting, or send a Supabase recovery/magic-link flow to the invite email. Also avoid returning raw invite tokens for flows that can affect existing accounts.

## Revalidation

**Verdict:** fixed

The current route no longer returns a bearer invite token or inviteUrl to the creator. The only response body on successful creation is { invite: serializeInvite(invite) }, and serializeInvite omits all token material. The raw token is generated inside createRestaurantInvite and immediately used for the outbound invite email, while the persisted token_hash is not exposed by the API serializer. The downstream accept endpoint also no longer updates existing users' passwords; it requires the invitee to already be authenticated as the invited email. A manager or owner can still invite an arbitrary email, but without mailbox access or an authenticated matching session they cannot use the token to take over that account. The reported account-takeover chain has been broken by the current code.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-19)

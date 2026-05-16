# [CRITICAL] Team invite creation leaks bearer invite tokens enabling account takeover

**File:** [`src/app/app/(app)/settings/restaurant/team/page.tsx`](<https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/app/(app)/settings/restaurant/team/page.tsx#L10-L11>) (lines 10, 11)
**Project:** nabatableLP
**Severity:** CRITICAL • **Confidence:** high • **Slug:** `auth-bypass`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The team settings flow creates invites through the ops invitation route. That route returns the raw invite token and inviteUrl in its JSON response after createRestaurantInvite sends the email. The public accept endpoint treats possession of that token as sufficient authority and, for an existing email, calls Supabase admin.updateUserById with the attacker-supplied password. A restaurant owner/manager can invite any existing user's email, read the token from the create response, accept the invite with a chosen password, and then sign in as that victim account.

## Recommendation

Never return raw invite tokens from the ops API. Only send the token to the invited mailbox, and change the accept flow so existing accounts must authenticate as the invited email before membership is added; do not reset existing users' passwords from an invite token alone.

## Revalidation

**Verdict:** fixed

The team settings page routes invite creation through the ops invitation service, and the current ops route no longer returns raw token or inviteUrl fields. Its success response serializes only non-secret invite metadata. The raw token is used only in sendTeamInviteEmail, and the client-side success message displays the invited email and expiry, not an acceptance link. The accept endpoint has also been changed so token possession is not enough to create or reset an auth account; a matching authenticated session is required. This removes the page-level exploit chain where an owner or manager could read the create response and accept as a victim. The relevant invite route and helper changes are in commit 020a7389.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-17)

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

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-17)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.

# [CRITICAL] Invite creator receives a bearer token that can reset existing users' passwords

**File:** [`src/app/api/ops/team/invitations/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/team/invitations/route.ts#L146-L159) (lines 146, 155, 158, 159)
**Project:** nabatableLP
**Severity:** CRITICAL • **Confidence:** high • **Slug:** `other-account-takeover`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

POST creates a restaurant invite and returns both the raw token and inviteUrl to the authenticated owner/manager. The related public accept handler looks up an existing auth user by invite email and calls admin.updateUserById with the attacker-supplied password before upserting the membership. A manager can invite any known existing user email, read the returned inviteUrl/token, call the accept endpoint, and take over that user's Supabase account across all of their restaurant memberships.

## Recommendation

Do not let invitation tokens authorize password resets for existing accounts. For existing users, require an authenticated session whose email matches the invite before accepting, or send a Supabase recovery/magic-link flow to the invite email. Also avoid returning raw invite tokens for flows that can affect existing accounts.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-19)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.

# [BUG] OAuth state consumption is not atomic

**File:** [`server/google-business-profile/service.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/google-business-profile/service.ts#L312-L917) (lines 312, 329, 343, 345, 896, 917)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-race-condition`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

consumeOAuthStateRecord first reads the OAuth state, checks consumed_at, then performs a separate update that only filters by id. Two concurrent callbacks with the same state can both pass the consumed_at check before either update is observed. completeGoogleBusinessProfileAuthorization then proceeds to exchange the code and update credentials/profile state. A duplicated callback can therefore leave the connection in an incorrect state, for example one request succeeds and a racing replay with the same single-use Google code fails invalid_grant and later marks the profile sync_error. If an attacker obtained an unused state token, the same race also weakens the intended one-time-use property.

## Recommendation

Consume the state with a single conditional operation, for example an UPDATE/RPC that filters by state_token, consumed_at IS NULL, and expires_at > now(), returns the row, and fails unless exactly one row was updated. Avoid credential writes unless that atomic consume succeeds.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-03)

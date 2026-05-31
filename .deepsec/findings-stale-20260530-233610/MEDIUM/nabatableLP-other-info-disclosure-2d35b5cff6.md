# [MEDIUM] Session recovery tokens expose guest contact PII in cleartext

**File:** [`server/security/session-recovery-access-token.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/server/security/session-recovery-access-token.ts#L104-L116) (lines 104, 108, 109, 114, 116)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-info-disclosure`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

createSessionRecoveryAccessToken serializes restaurantId, email, and phone directly into a base64url JSON payload and only signs it with HMAC. These tokens are used as access_token query parameters in booking recovery URLs, so URL logs, browser history, email scanners, or retained expired links can reveal the guest's email and phone without needing the HMAC secret. Signing protects integrity, not confidentiality.

## Recommendation

Use an opaque random recovery token backed by a server-side record, or encrypt the payload with an authenticated encryption/JWE-style construction. Avoid placing recoverable PII inside URL-bearing tokens.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-11)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-25)

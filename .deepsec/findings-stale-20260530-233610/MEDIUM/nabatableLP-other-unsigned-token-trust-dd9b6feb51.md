# [MEDIUM] Unsigned token payload is parsed and exposed before signature verification

**File:** [`server/security/session-recovery-access-token.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/server/security/session-recovery-access-token.ts#L133-L150) (lines 133, 140, 145, 150)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-unsigned-token-trust`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

validateSessionRecoveryAccessToken decodes and Zod-parses the attacker-controlled payload before checking the HMAC, then returns parsedPayload.restaurantId on invalid_signature. Public callers such as the guest booking lookup path use that unauthenticated restaurantId in diagnostics/observability before their lookup rate limiter runs, allowing forged tokens to pollute tenant-scoped security telemetry and add avoidable parsing/HMAC work on unauthenticated requests.

## Recommendation

Verify the HMAC over the raw prefix and payload before JSON parsing, enforce a small maximum token length, and only return restaurantId after the signature is valid. Rate-limit invalid token attempts before writing observability events.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-11)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-25)

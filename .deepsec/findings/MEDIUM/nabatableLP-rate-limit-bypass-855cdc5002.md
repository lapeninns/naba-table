# [MEDIUM] Rate limits trust spoofable X-Forwarded-For values

**File:** [`server/security/request.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/security/request.ts#L10-L16) (lines 10, 15, 16)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `rate-limit-bypass`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

extractClientIp falls back to the first x-forwarded-for entry without validating that the header was set or normalized by a trusted proxy. Several sensitive public flows use this value directly in consumeRateLimit identifiers, including guest booking lookup, booking creation, availability checks, confirmation token checks, and magic-link sign-in throttling. If the deployment edge appends to or passes through a client-supplied X-Forwarded-For header, an attacker can rotate that header to get a fresh rate-limit bucket per request and brute-force/abuse these flows. This is mitigated only if the hosting layer overwrites the header before the app sees it; there is no code-level trust-boundary enforcement here.

## Recommendation

Derive the client IP only from a trusted platform-provided source or from a proxy-normalized header that clients cannot set. If X-Forwarded-For must be used, parse it according to a configured trusted-proxy chain and take the first untrusted hop, validate it as an IP address, and reject or collapse malformed values. Keep non-IP identifiers such as authenticated user ID, normalized email, or restaurant/contact hashes in rate-limit keys where appropriate.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-10-12)

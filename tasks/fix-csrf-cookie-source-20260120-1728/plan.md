---
task: fix-csrf-cookie-source
timestamp_utc: 2026-01-20T17:28:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: CSRF cookie single source of truth

## Objective

We will unify CSRF cookie configuration so that admin password login does not fail after session expiry due to mismatched CSRF cookies.

## Success Criteria

- [ ] CSRF cookie options (domain, max age, secure, sameSite) come from a single shared helper.
- [ ] Browser and server use the same domain-scoped CSRF cookie in production.
- [ ] Admin password login succeeds without needing cache clears after session expiry.

## Architecture & Components

- `lib/security/csrf.ts`: add shared CSRF cookie option helper and normalize browser cookie.
- `server/security/csrf.ts`: use shared helper for cookie options.
- `src/proxy.ts`: use shared helper for cookie options.

## Data Flow & API Contracts

- No API contract changes; `/api/auth/signin` still validates CSRF header vs cookie.

## UI/UX States

- None (no UI changes).

## Edge Cases

- Existing host-only CSRF cookies from prior versions; normalize to domain cookie with same value.
- `localhost` and IP-based hosts should not set a domain attribute.

## Testing Strategy

- Smoke test admin password login (valid CSRF header/cookie).
- Verify CSRF cookie domain in browser devtools on app and root domains.

## Rollout

- No feature flag.
- Deploy with standard release; monitor auth/signin 403 rates.

## DB Change Plan (if applicable)

- Not applicable.

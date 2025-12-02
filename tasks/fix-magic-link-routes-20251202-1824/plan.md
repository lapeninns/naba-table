---
task: fix-magic-link-routes
timestamp_utc: 2025-12-02T18:24:59Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Fix magic link auth + callback routing

## Objective

Ensure magic-link authentication succeeds and redirects users to the correct destination (guest vs staff) while keeping security controls intact.

## Success Criteria

- [ ] Magic-link callback sets a session for both `code` and `token_hash` flows without throwing.
- [ ] Valid `redirectedFrom` is honored; invalid/absent redirects fall back to sensible defaults (`defaultRedirectForHost`/config).
- [ ] Staff land in app dashboard; guests land in guest dashboard when no redirect provided.
- [ ] Existing password sign-in behavior remains unaffected.
- [ ] Tests cover callback routing logic for code vs token_hash + sanitized redirect vs fallback.

## Architecture & Components

- `src/app/api/auth/callback/route.ts`: central handler for magic link/callback. Will merge reliable fallback logic from `43ee2e6` with current token_hash handling and non-fatal customer linking.
- `lib/auth/redirects.ts`: already provides `sanitizeRedirect` and `defaultRedirectForHost`; reuse unchanged.
- Tests (likely in `src/app/api/auth/__tests__` or new colocated file) to verify routing decisions.

## Data Flow & API Contracts

- Input: GET `/api/auth/callback?code=...&redirectedFrom=...` or `token_hash=...&type=magiclink|email`.
- Behavior: verify OTP via `verifyOtp` when `token_hash` present; otherwise `exchangeCodeForSession(code)`. On success, optionally link customers (non-blocking). Determine destination: sanitized `redirectedFrom` else host-based default (/app|/guest) or config fallback. Respond with 302 redirect.
- Errors: On verification failure, redirect to login with error params as today.

## UI/UX States

- No UI components changed; relies on API redirect.

## Edge Cases

- Missing `NEXT_PUBLIC_ROOT_DOMAIN` → still redirect via default host fallback.
- Invalid or malicious `redirectedFrom` → rejected and fallback used.
- Service client unavailable → skip customer linking and membership lookup but continue auth redirect.
- Magic link with token_hash but no type/code → warn and fallback redirect without session change.

## Testing Strategy

- Unit/route tests: simulate request with `code` + valid redirect; with `token_hash` + type; with invalid redirect; with no redirect to ensure staff vs guest resolution.
- (Manual) Post-change, run targeted tests `pnpm test` subset for auth routes if available.

## Rollout

- No flags. Ship fix directly; rely on existing rate limits/CSRF.
- Monitor auth logs for callback errors post-deploy.

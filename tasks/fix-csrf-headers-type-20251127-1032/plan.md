---
task: fix-csrf-headers-type
timestamp_utc: 2025-11-27T10:32:28Z
owner: github:@amankumarshrestha
reviewers: []
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Fix CSRF headers type error

## Objective

Restore the production build by updating CSRF helper code to match Next.js 16 async headers API while keeping cookie security logic unchanged.

## Success Criteria

- [ ] `pnpm run build` completes without the TypeScript error about `headers().get`.
- [ ] `pnpm run build` completes without the `parseBooleanEnv` temporal dead zone error in `server/security/rate-limit.ts`.
- [ ] CSRF cookie logic continues to mark cookies `secure` when the forwarded protocol is https or when not in development.

## Architecture & Components

- `server/security/csrf.ts`: adjust `shouldUseSecureCookie()` to await `headers()` once and use the returned `ReadonlyHeaders`.
- `server/security/rate-limit.ts`: reorder `parseBooleanEnv` helper (or make it a function declaration) so it is defined before first use.

## Data Flow & API Contracts

- No external API changes. `ensureCsrfCookie()` and `validateCsrfToken()` signatures stay the same; only internal header retrieval becomes async.

## UI/UX States

- N/A (server-side security helper). No UI changes.

## Edge Cases

- Missing `x-forwarded-proto` header should continue to fall back to env-based decision.
- Multiple forwarded proto values (comma-separated) should still consider the first value after trimming.
- Rate limit env parsing should still treat undefined/malformed values as `undefined`, preserving existing bypass/allow flags.

## Testing Strategy

- Run `pnpm run build` to confirm TypeScript compilation success.
- If time permits, run targeted unit coverage not available; rely on build for static validation.

## Rollout

- No feature flags. Change is safe to ship immediately after build/test verification.

## DB Change Plan (if applicable)

- Not applicable (no DB changes).

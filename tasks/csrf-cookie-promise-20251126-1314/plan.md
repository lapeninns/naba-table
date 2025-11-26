---
task: csrf-cookie-promise
timestamp_utc: 2025-11-26T13:14:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Fix CSRF cookie Promise typing

## Objective

Align the CSRF cookie helper with the async `cookies()` API so sign-in pages set or reuse the CSRF token without type errors and the production build succeeds.

## Success Criteria

- [ ] `pnpm run build` passes without TypeScript errors.
- [ ] CSRF token is reused when present and created when missing.

## Architecture & Components

- `server/security/csrf.ts`: make `ensureCsrfCookie` async, await `cookies()`, keep token generation and setter.
- `src/app/auth/signin/page.tsx`, `src/app/app/(app)/login/page.tsx`: await the async helper during render.

## Data Flow & API Contracts

- `cookies()` returns `ReadonlyRequestCookies`; use its `get`/`set` to read/write the CSRF cookie. Function returns the token string for downstream use if needed.

## UI/UX States

- Not UI-impacting; sign-in pages continue to render normally.

## Edge Cases

- Cookie already set → reuse token, no additional write.
- Missing cookie → generate token, set with existing options (httpOnly=false, secure in non-dev, lax, path `/`).

## Testing Strategy

- Run `pnpm run build` to ensure type check passes.

## Rollout

- No flag. Simple helper change.

## DB Change Plan

- N/A

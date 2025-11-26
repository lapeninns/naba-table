---
task: csrf-cookie-promise
timestamp_utc: 2025-11-26T13:14:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Fix CSRF cookie Promise typing

## Requirements

- Functional: ensure CSRF token cookie is available when rendering sign-in pages; unblock production build.
- Non-functional: maintain CSRF protection semantics; compatible with Next.js 16 async `cookies()` API.

## Existing Patterns & Reuse

- `server/security/csrf.ts` handles token creation and validation.
- Sign-in pages (`src/app/auth/signin/page.tsx`, `src/app/app/(app)/login/page.tsx`) call `ensureCsrfCookie()` during server render.

## External Resources

- Next.js 16 `cookies()` now returns `Promise<ReadonlyRequestCookies>` (see `node_modules/next/dist/server/request/cookies.d.ts`).

## Constraints & Risks

- Helper must remain usable in server components and route handlers.
- Token reuse should continue when cookie already exists; only set when missing.

## Open Questions (owner, due)

- None identified.

## Recommended Direction (with rationale)

- Make `ensureCsrfCookie` async to await `cookies()` and keep logic intact.
- Update call sites to await the Promise so the cookie is set before render completes.

---
task: login-magic-link-expiry
timestamp_utc: 2025-11-27T00:32:57Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Login magic link session expiry

## Requirements

- Functional: Users in production see "Session expired. Refresh and try again." on `http://app.localhost:3000/app/login?redirectedFrom=%2Fapp`; magic link email cannot be sent.
- Non-functional: Maintain security; avoid exposing secrets; adhere to existing auth patterns.

## Existing Patterns & Reuse

- Auth submitters use `fetchJson`, which automatically forwards the CSRF header if the `sr-csrf-token` cookie exists.
- CSRF token generator lives in `server/security/csrf.ts` (`ensureCsrfCookie`), but it is **not invoked anywhere** after recent cleanup.
- `/api/auth/signin` route requires matching `x-csrf-token` header + `sr-csrf-token` cookie; without it, it returns 403.
- Login UI (`components/auth/SignInForm`) maps 403 → “Session expired. Refresh and try again.” and magic-link calls hit the same endpoint.

## External Resources

- TBD (supabase auth/magic link docs if relevant).

## Constraints & Risks

- Production issue; risk of login outage.
- Magic link email delivery may involve external provider (verify configuration) and environment variables; avoid exposing secrets.
- CSRF cookie uses `secure` when `env.node.appEnv !== "development"`; if the environment is marked “production” but served over plain HTTP (e.g., `app.localhost`), the cookie will not set—verify scheme/domain.

## Open Questions (owner, due)

- What auth provider/service powers magic links? (owner: self)
- Are recent auth/session changes deployed? (owner: self)
- Any errors in server logs for magic-link send endpoint? (owner: self)

* Do we need to adjust CSRF cookie `secure` in non-HTTPS prod-like environments? (owner: self)

## Recommended Direction (with rationale)

- Set the CSRF cookie when rendering login pages (ops + guest) via `ensureCsrfCookie` so fetches include the required header and avoid 403.
- Validate whether the secure flag blocks the cookie on the affected host; if so, document/adjust per env.

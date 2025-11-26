---
task: login-csrf-cookie-fix
timestamp_utc: 2025-11-26T21:20:00Z
owner: github:@amankumarshrestha
reviewers: []
risk: medium
flags: []
related_tickets: []
---

# Research: Fix login CSRF cookie error (Next.js 16)

## Requirements

- Functional: Login pages (`/app/login`, `/auth/signin`) must render without throwing and must expose a CSRF token for downstream auth requests.
- Non-functional: Keep CSRF semantics intact; comply with Next.js 16 rule that cookies are only set inside Route Handlers or Server Actions.

## Existing Patterns & Reuse

- `src/middleware.ts` already sets a `csrf_token` cookie for every request when missing.
- `ensureCsrfCookie` helper in `server/security/csrf.ts` generates and sets the same cookie but is called from server components.
- Both login pages import `ensureCsrfCookie`; ops login already commented out but still referenced, auth login still calls it.

## External Resources

- Next.js 16 change: `cookies()` setter only permitted in Route Handlers or Server Actions (error surfaced in dev log).

## Constraints & Risks

- Must avoid setting cookies inside server components to prevent runtime errors.
- Ensure CSRF token remains available to client code after removing helper call (middleware must cover all relevant routes).

## Open Questions (owner, due)

- Q: Is any endpoint expecting a freshly generated CSRF token beyond middleware coverage? (owner: github:@amankumarshrestha, due: before release)
  A: Pending confirmation; current assumption is middleware runs on all relevant routes.

## Recommended Direction (with rationale)

- Rely on `src/middleware.ts` to set the CSRF cookie; remove `ensureCsrfCookie` calls from server components to satisfy Next.js 16 rules.
- Keep helper available for Route Handlers/Server Actions if needed; document usage restriction.

---
task: fix-csrf-cookie-source
timestamp_utc: 2026-01-20T17:28:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: CSRF cookie single source of truth

## Requirements

- Functional:
  - Ensure CSRF cookie is defined once with consistent domain/attributes across app.
  - Prevent mismatched CSRF token between browser header and server cookie validation.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Preserve existing CSRF protections and cross-subdomain behavior.
  - Avoid introducing UI changes.

## Existing Patterns & Reuse

- `lib/security/csrf.ts` defines CSRF constants and browser token behavior.
- `server/security/csrf.ts` sets CSRF cookies on sign-in pages.
- `src/proxy.ts` sets CSRF cookie for all requests.
- `lib/supabase/cookies.ts` exposes `resolveCookieDomain` for consistent domain handling.

## External Resources

- None.

## Constraints & Risks

- Keep changes scoped to CSRF cookie handling; avoid unrelated refactors.
- Maintain cross-subdomain cookie sharing in production.

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- Centralize CSRF cookie options in `lib/security/csrf.ts` and reuse from both server and proxy.
- Normalize browser-set cookies to the same domain to prevent mismatches after session expiry.

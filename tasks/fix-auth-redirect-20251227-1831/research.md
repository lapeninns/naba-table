---
task: fix-auth-redirect
timestamp_utc: 2025-12-27T18:32:23Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Fix auth redirect on app subdomain

## Requirements

- Functional:
  - Logging in on app subdomain (e.g., app.localhost:3000) must land on /dashboard (app area).
  - Redirect sanitization must continue to block unsafe or non-allowed destinations.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Security: preserve host allowlist protections and avoid open redirects.
  - No UI changes; no perf impact expected.

## Existing Patterns & Reuse

- Host-aware fallback redirect is centralized in `lib/auth/redirects.ts`.
- Auth callback uses `defaultRedirectForHost()` when redirect param is missing or rejected.
- Proxy rewrites /app routes on app subdomain and enforces guest vs app routing.

## External Resources

- None.

## Constraints & Risks

- Must follow AGENTS SDLC phases with task artifacts.
- Keep shared lib code framework-agnostic (lib/AGENTS.md).
- Avoid adding new redirects that could bypass whitelist.

## Open Questions (owner, due)

- Q: Should the fallback redirect be absolute (host-qualified) for app subdomain? (owner: github:@amankumarshrestha, due: 2025-12-27)
  A: Yes for non-local envs; keep relative on localhost to preserve app.localhost.

## Recommended Direction (with rationale)

- Align `defaultRedirectForHost()` to return an app-safe path that survives proxy rewrites/whitelist checks on app subdomain: return `/dashboard` for local app hosts and an absolute `https://app.<root>/dashboard` in non-local envs. Keep sanitize rules unchanged.

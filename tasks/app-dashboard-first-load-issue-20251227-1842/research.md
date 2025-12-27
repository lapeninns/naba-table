---
task: app-dashboard-first-load-issue
timestamp_utc: 2025-12-27T18:42:31Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: app.localhost /dashboard first load fails

## Requirements

- Functional:
  - Identify root cause for app subdomain `/dashboard` failing on first hit but loading after visiting another app route.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Do not weaken auth or proxy security.

## Existing Patterns & Reuse

- Proxy routing and auth gating in `src/proxy.ts`.
- Host-aware redirect logic in `lib/auth/redirects.ts`.
- App router pages under `src/app/app/**`.

## External Resources

- None.

## Constraints & Risks

- Follow AGENTS SDLC phases with task artifacts.
- Use Chrome DevTools MCP for UI verification if changes are made.
- No secrets in logs/artifacts.
- Ensure redirect logic does not introduce open-redirects; keep sanitization in ops sign-in.

## Open Questions (owner, due)

- Q: What error appears on first load (console/network)? (owner: github:@amankumarshrestha, due: 2025-12-27)
  A: First load on app.localhost redirects to `/auth/signin?redirectedFrom=/dashboard` (no console errors).
- Q: Is this only on app.localhost or also app.<rootDomain>? (owner: github:@amankumarshrestha, due: 2025-12-27)
  A: UNCONFIRMED (not tested).

## Recommended Direction (with rationale)

- Enforce ops sign-in to occur on the app host when redirectedFrom points to ops routes so session cookies are scoped correctly.

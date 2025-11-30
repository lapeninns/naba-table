---
task: localhost-redirect
timestamp_utc: 2025-11-30T18:51:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Prevent localhost redirecting to nabatable.com

## Requirements

- Functional: When running locally, navigating to `http://localhost:3000/app/*` must stay on localhost and not redirect to `nabatable.com` or `app.nabatable.com`.
- Non-functional: Keep existing production redirect behavior and API guarding intact; no change for deployed environments.

## Existing Patterns & Reuse

- Routing and domain logic lives in `src/middleware.ts` via `handleRouting` using `NEXT_PUBLIC_ROOT_DOMAIN` to build host sets.
- Redirect causing issue: In web-host branch, `/app/*` on any web host (includes `localhost`) redirects to `https://app.${rootDomain}`. With `.env.local` setting `NEXT_PUBLIC_ROOT_DOMAIN=nabatable.com`, localhost is treated like prod.

## Constraints & Risks

- Must not break prod canonicalization (root -> app subdomain) or ops API rewrites.
- Middleware runs for all requests; changes should be small and branch on hostname to avoid regressions.

## Open Questions

- None identified; scope is confined to localhost behavior.

## Recommended Direction

- Add explicit localhost guard: when `hostname === "localhost"` (and optionally `127.0.0.1`) skip cross-domain redirects and keep requests on the same host, allowing /app paths to serve locally.
- Keep production behavior unchanged for other hosts.

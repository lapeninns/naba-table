---
task: app-host-local
timestamp_utc: 2025-11-27T23:40:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Local app host mismatch

## Requirements

- Functional: app subdomain should work in local dev when accessed via either `app.localhost` or `app.localhost.com`.
- Non-functional: preserve existing prod behavior; avoid widening redirects unexpectedly; keep auth/cookie scoping intact.

## Existing Patterns & Reuse

- Middleware host allowlists: `APP_HOSTS` currently includes `app.${ROOT_DOMAIN}` and `app.localhost` (see src/middleware.ts).
- Env: `NEXT_PUBLIC_ROOT_DOMAIN` defaults to `localhost`; docs/dev-routing.md instructs using `app.localhost` with /etc/hosts.

## External Resources

- N/A (internal routing docs only).

## Constraints & Risks

- Changing host matching could affect redirects in prod if not scoped correctly.
- Cookie domain logic depends on `ROOT_DOMAIN`; must avoid setting `.localhost.com` inadvertently when ROOT_DOMAIN is default.

## Open Questions (owner, due)

- None at this time.

## Recommended Direction (with rationale)

- Expand `APP_HOSTS` to include `app.localhost.com` only for local default root, ensuring prod hosts untouched.
- Document required /etc/hosts entries for `.com` variant in dev docs to align with user expectation.

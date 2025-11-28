---
task: magic-link-landing
timestamp_utc: 2025-11-28T12:32:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Magic-link landing domains

## Requirements

- Restaurant users who sign in via magic link must land on `https://www.nabatable.com/app`.
- Guest users who sign in via magic link must land on `https://www.nabatable.com/guest`.
- Keep security: no open redirects; stay within allowed hosts/paths.

## Existing Patterns & Reuse

- Magic-link flow handled by `src/app/api/auth/signin/route.ts` (builds `emailRedirectTo` with `redirectedFrom`).
- Callback exchange and redirect handled by `src/app/api/auth/callback/route.ts` using `sanitizeRedirect` + `defaultRedirectForHost` from `lib/auth/redirects.ts`.
- Forms set default redirect paths: ops `/app`, guest `/guest/dashboard` (relative).

## Constraints & Risks

- Avoid open redirect; only allow whitelisted hosts/paths.
- Preserve localhost/dev behavior (rootDomain may be `localhost`).
- `router.replace` on password sign-in expects same-origin; avoid changing that path.

## Open Questions

- None; host requirement is explicit.

## Recommended Direction

- Expand redirect utilities to accept/return absolute URLs and allow the canonical host `www.<rootDomain>`.
- Keep relative redirects unchanged for dev/local; convert to absolute for real domains.
- Update callback + signin flows to resolve to absolute `www` URLs for magic links while keeping password sign-in paths unchanged.

---
task: magic-link-landing
timestamp_utc: 2025-11-28T12:32:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Magic-link landing domains

## Objective

Route magic-link sign-ins to the correct host and section: restaurants → `https://www.nabatable.com/app`, guests → `https://www.nabatable.com/guest`, without introducing open redirects or breaking dev.

## Success Criteria

- [ ] Sanitized redirect allows only allowed host (`www.<rootDomain>`/rootDomain) and approved paths.
- [ ] Callback resolves to `https://www.nabatable.com/app` for restaurant flows by default; guest flows to `https://www.nabatable.com/guest`.
- [ ] Dev/localhost flows remain functional.

## Architecture & Components

- `lib/auth/redirects.ts`: allow absolute URLs for allowed host; add helper to produce absolute `www` URL; adjust default redirect logic.
- `src/app/api/auth/signin/route.ts`: use new sanitizer with rootDomain; ensure magic-link email uses absolute redirect target.
- `src/app/api/auth/callback/route.ts`: resolve redirect using new helper to send user to absolute `www` host.

## Testing Strategy

- Unit not required; manual checks via dev server: guest magic link and ops magic link send redirect param as absolute and callback redirects accordingly.

## Rollout

- No feature flag; small surface. Ensure sign-in still works on localhost.

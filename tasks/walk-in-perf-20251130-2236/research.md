---
task: walk-in-perf
timestamp_utc: 2025-11-30T22:36:13Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Speed up walk-in/auth pages

## Requirements

- Functional: reduce time-to-interactive for `/walk-in` and related auth entry; avoid extra redirects; keep auth flow intact.
- Non-functional (a11y, perf, security, privacy, i18n): meet perf budgets (LCP ≤2.5s mobile 4G), no regressions to auth security, maintain accessibility semantics of form.

## Existing Patterns & Reuse

- Next.js App Router with route groups; uses Shadcn UI inputs/buttons for auth forms.
- Global NProgress + Plausible initialized in shared layout.
- Auth page already server-rendered but ships many client chunks.

## External Resources

- Vercel/Next docs on static routes & caching; Plausible script lazy load guidance.

## Constraints & Risks

- Must not break auth/session flows or CSRF tokens.
- Cache headers must still respect auth state (page is public, so safe to cache HTML).
- Need to keep a11y (skip links, labels) untouched.

## Open Questions (owner, due)

- None identified yet.

## Recommended Direction (with rationale)

- Remove unnecessary redirect chain by routing `/walk-in` directly to signin component.
- Mark signin route as static/ISR to enable Vercel cache hits and faster TTFB.
- Defer non-critical scripts (Plausible, NProgress) to reduce main-thread contention.
- Convert signin form to server components / minimal client JS where possible or centralize client boundary.

---
task: post-mvp-improvements
timestamp_utc: 2026-01-24T01:07:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Post-MVP Improvements

## Requirements

- Functional:
  - Resolve known broken routes/CTAs and redirect issues.
  - Ensure auth redirect targets are valid.
  - Guard test endpoints in production.
  - Replace full page reload UX with router refresh.
  - Add a health check endpoint.
  - Establish a structured logging baseline.
  - Plan for error monitoring integration (requires credentials).
- Non-functional (a11y, perf, security, privacy, i18n):
  - No regressions in auth/security flows.
  - Maintain accessibility for error/CTA updates.
  - Preserve routing behavior across subdomains.

## Existing Patterns & Reuse

- See `docs/BROKEN-LINKS-AND-ISSUES.md` for known routing fixes.
- See `docs/PRODUCTION-READINESS.md` for readiness gaps and recommended improvements.
- See `docs/CRITICAL-ISSUES.md` for security/monitoring gaps and test endpoint guards.
- Ops navigation uses `/app`-prefixed paths in `src/components/features/ops-shell/navigation.tsx`.
- Structured logger exists in `lib/logger.ts` and is already used in `server/**` modules.

## External Resources

- Sentry Next.js setup docs (for monitoring integration).

## Constraints & Risks

- External monitoring setup requires credentials and org/project decisions.
- Routing fixes must respect subdomain proxy behavior (`src/proxy.ts`).
- Test endpoints must remain protected in non-prod but disabled in prod.
- Some ops UI links use `/dashboard` or unprefixed ops paths; in single-host mode these can 404.

## Open Questions (owner, due)

- Q: Which monitoring provider should be used and what credentials should be supplied?
  A: UNCONFIRMED (owner: github:@maintainers, due: 2026-01-24)
- Q: Should ops links standardize on `/app/*` for single-host compatibility?
  A: UNCONFIRMED (owner: github:@maintainers, due: 2026-01-24)

## Recommended Direction (with rationale)

- Prioritize user-facing routing/CTA fixes and redirect validation first to reduce UX breakage.
- Add health check + structured logging baseline without external secrets.
- Defer full monitoring integration until credentials are provided.

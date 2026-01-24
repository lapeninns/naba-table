---
task: post-mvp-improvements
timestamp_utc: 2026-01-24T01:07:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Post-MVP Improvements

## Objective

We will resolve known UX-breaking routes/CTAs, harden redirects and test endpoint guards, and establish operational baselines (health + logging) so the booking app is safer and more reliable post-MVP.

## Success Criteria

- [ ] Broken CTAs and redirects listed in docs are fixed and verified.
- [ ] Auth redirect validation prevents invalid targets.
- [ ] Test endpoints are guarded by environment checks.
- [ ] Health check endpoint returns expected status.
- [ ] Logging baseline exists without leaking secrets.
- [ ] Monitoring integration plan documented; credentials requested.

## Architecture & Components

- Routing fixes: update CTA links and redirect validation in app routes.
- Auth redirect sanitization: enforce allow-list of valid routes.
- Test endpoint guards: consistent guard helper across test routes.
- Health check API: new `/api/health` route.
- Logging baseline: shared logger module used in server-side flows.

## Data Flow & API Contracts

Endpoint: GET /api/health
Response: { status: 'healthy', database: 'unknown' | 'connected' | 'unreachable', version: string }
Errors: { status: 'unhealthy', message: string }

## UI/UX States

- Error/CTA routes must land on valid pages for guest and ops users.

## Edge Cases

- Redirect target provided via query parameter is invalid or missing.
- Subdomain routing with duplicate `/app` prefix.
- Single-host mode where ops links must preserve `/app` prefix.

## Testing Strategy

- Unit: auth redirect sanitizer if exists.
- Integration: verify route handlers for test endpoints and health.
- E2E: smoke test for critical CTAs if existing suite supports.
- Accessibility: error/CTA updates should preserve labels and focus.

## Rollout

- Feature flag: none.
- Monitoring: add checks to existing observability scripts if needed.
- Kill-switch: revert to previous redirect behavior if issues.

## Monitoring Integration Plan (Blocked)

- Install `@sentry/nextjs` and configure `next.config.ts` with `withSentryConfig` (requires org + project slugs).
- Add `sentry.client.config.ts`, `sentry.server.config.ts`, and `sentry.edge.config.ts` with `dsn` and sampling configuration.
- Add `instrumentation.ts` to load Sentry server/edge configs and export `onRequestError`.
- Required env vars: `SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`.

## DB Change Plan (if applicable)

- No DB changes planned.

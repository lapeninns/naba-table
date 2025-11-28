---
task: app-host-local
timestamp_utc: 2025-11-27T23:40:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Local app host support

## Objective

Allow local dev to reach the app experience via both `app.localhost` and `app.localhost.com` without impacting production routing.

## Success Criteria

- [ ] `app.localhost:3000` continues to route to the app.
- [ ] `app.localhost.com:3000` routes identically in dev when ROOT_DOMAIN is default.
- [ ] No change to prod host matching or cookie scoping when ROOT_DOMAIN != localhost.

## Architecture & Components

- Middleware host allowlist (`src/middleware.ts`): add conditional dev host.
- Docs (`docs/dev-routing.md`): note optional `.com` host mapping.

## Data Flow & API Contracts

- No API changes; middleware hostname classification only.

## UI/UX States

- None (routing infrastructure only).

## Edge Cases

- Ensure WEB_HOSTS does not pick up `.localhost.com` unexpectedly.
- Avoid broad wildcard that could accept unintended hosts.

## Testing Strategy

- Unit: extend `src/middleware.test.ts` to cover `app.localhost.com` when ROOT_DOMAIN is default.
- Manual: start dev server with /etc/hosts entries and verify both hosts load without redirect loops.

## Rollout

- No flags; dev-only behavior change.
- Validate via local manual test; no deployment change required.

## DB Change Plan

- N/A

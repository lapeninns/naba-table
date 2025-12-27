---
task: routing-improvements
timestamp_utc: 2025-12-27T17:02:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Routing Improvements (Host Redirects, Dev Guard, Tests)

## Objective

Improve host-based routing clarity and safety in local development while keeping production behavior intact.

## Success Criteria

- [ ] Cross-host redirects are absolute (app host → root host).
- [ ] `www.localhost` redirect is disabled in development.
- [ ] Proxy tests are picked up by Vitest.
- [ ] A routing smoke script exists for guest/app hosts.

## Architecture & Components

- `src/proxy.ts`: adjust cross-host redirects.
- `next.config.js`: guard www redirect based on env.
- `tests/` or `vitest.config.ts`: ensure proxy test discoverability.
- `scripts/` or `tools/`: add a routing smoke script.

## Data Flow & API Contracts

- No API contract changes.

## UI/UX States

- N/A (no UI changes).

## Edge Cases

- Avoid relative redirects on cross-host routes.
- Ensure no redirect loops between `app.localhost` and `localhost`.

## Testing Strategy

- Unit: proxy routing test in Vitest.
- Manual: run routing smoke script (HEAD requests with Host header).

## Rollout

- No feature flags.
- Local dev verification only.

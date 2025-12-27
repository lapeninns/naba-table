---
task: fix-middleware-entrypoint
timestamp_utc: 2025-12-27T13:10:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Implementation Plan: Restore Next.js Middleware Entry Point

## Objective

Ensure Next.js executes proxy-based middleware logic in `src/proxy.ts` without introducing a conflicting `middleware.ts`.

## Success Criteria

- [ ] `src/proxy.ts` is the sole proxy/middleware entry point (no `middleware.ts`).
- [ ] Proxy matcher remains intact.
- [ ] Ops guard and CSRF cookie issuance run on requests.
- [ ] Local dev uses `NEXT_PUBLIC_ROOT_DOMAIN=localhost` so `app.localhost` is recognized.

## Architecture & Components

- `src/proxy.ts`: existing routing/auth/CSRF logic and entry point.

## Data Flow & API Contracts

- No API contract changes.

## UI/UX States

- None (no UI change).

## Edge Cases

- Ensure Next.js picks up middleware only once (avoid duplicate entry points).

## Testing Strategy

- Unit: run middleware tests if available (`src/middleware.test.ts`).
- No UI QA required (no UI change).

## Rollout

- No feature flag; direct fix.

## DB Change Plan (if applicable)

- N/A.

---
task: remove-sentry-completely
timestamp_utc: 2026-02-15T14:38:03Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Remove Sentry Completely

## Objective

Remove all Sentry integration points so builds and runtime no longer depend on Sentry while preserving current app behavior for routing, error boundaries, and PostHog instrumentation.

## Success Criteria

- [ ] `@sentry/nextjs` is removed from `package.json` and lockfile.
- [ ] No runtime/config imports or references to Sentry remain in active codepaths.
- [ ] `next build` no longer emits Sentry runAfterProductionCompile output.
- [ ] Sentry sample route files and Sentry config files are removed.

## Architecture & Components

- `next.config.js`: export base Next config directly (remove `withSentryConfig`).
- `src/instrumentation.ts`: keep minimal no-op register hook and remove `onRequestError` Sentry export.
- `src/instrumentation-client.ts`: remove Sentry init/replay logic; preserve PostHog pageview capture on route transitions.
- `src/app/global-error.tsx`: remove Sentry capture side effect; keep default `NextError` rendering.
- `src/hooks/ops/useRealtimeErrorHandler.ts`: remove window Sentry capture branch.

## Data Flow & API Contracts

- Remove test-only API route `GET /api/sentry-example-api`.
- Remove test-only page route `/sentry-example-page`.

## UI/UX States

- No product UI changes beyond deleting Sentry example page.

## Edge Cases

- Ensure route-transition export signature remains valid after removing Sentry typings.
- Ensure no unresolved imports from deleted route/config files.

## Testing Strategy

- Search sweep for `@sentry/nextjs` and `withSentryConfig`.
- Run `pnpm run typecheck`.
- Run `pnpm run build`.

## Rollout

- No feature flag needed.
- Deploy normally after CI passes.
- Monitoring impact: Sentry events cease immediately after deploy.

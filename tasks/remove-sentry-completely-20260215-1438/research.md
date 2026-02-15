---
task: remove-sentry-completely
timestamp_utc: 2026-02-15T14:38:03Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Remove Sentry Completely

## Requirements

- Functional:
  - Remove Sentry package, Next.js wrapper config, runtime initialization, and Sentry sample routes.
  - Ensure no remaining app/runtime imports from `@sentry/nextjs`.
  - Keep non-Sentry observability (PostHog pageviews/events) intact.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Maintain existing behavior for global error boundary rendering and route transition instrumentation hooks.
  - Remove any committed Sentry secret artifacts.

## Existing Patterns & Reuse

- Sentry is currently initialized in `src/instrumentation-client.ts`, `src/instrumentation.ts`, and wrapped in `next.config.js`.
- `src/app/global-error.tsx` captures exceptions via Sentry but otherwise uses default Next error rendering.
- `src/hooks/ops/useRealtimeErrorHandler.ts` has optional runtime capture to `window.Sentry`.
- Sentry test paths exist at `src/app/sentry-example-page/page.tsx` and `src/app/api/sentry-example-api/route.ts`.

## External Resources

- None required for removal; this is internal integration teardown.

## Constraints & Risks

- Removing `onRequestError` or transition hooks incorrectly can break expected Next instrumentation exports.
- Deleting sample routes may break links if any internal references remain.
- Build can still fail due to unrelated existing TypeScript issues.

## Open Questions (owner, due)

- Q: Should Sentry-only docs references in historical task artifacts be edited?
  A: No, leave historical artifacts untouched; remove only active/runtime integration paths.

## Recommended Direction (with rationale)

- Fully uninstall Sentry from runtime/config/dependencies and delete Sentry-only files.
- Preserve Next instrumentation entrypoints where needed, but implement only PostHog logic.
- Remove committed Sentry build token file to reduce secret exposure risk.

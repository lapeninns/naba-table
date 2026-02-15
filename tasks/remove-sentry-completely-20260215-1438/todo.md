---
task: remove-sentry-completely
timestamp_utc: 2026-02-15T14:38:03Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm AGENTS policy stack for touched paths.
- [x] Identify all Sentry references in runtime/config/dependencies.

## Core Removal

- [x] Remove Sentry wrapper/config from `next.config.js`.
- [x] Remove Sentry runtime initialization from instrumentation files.
- [x] Remove Sentry capture from app global error boundary and realtime hook.
- [x] Delete Sentry sample route/page and Sentry config files.
- [x] Delete Sentry build env token file.
- [x] Remove `@sentry/nextjs` dependency and refresh lockfile.

## Verification

- [x] `rg -n --hidden -S "@sentry/nextjs|withSentryConfig|SENTRY_AUTH_TOKEN"` shows no active runtime/config references.
- [ ] `pnpm run typecheck` (fails on pre-existing non-Sentry TS errors)
- [ ] `pnpm run build` (fails at existing PostHog TS error; no Sentry compile hooks observed)

## Notes

- Assumptions: historical docs/task artifacts may keep Sentry mentions and are not runtime codepaths.
- Deviations: none.

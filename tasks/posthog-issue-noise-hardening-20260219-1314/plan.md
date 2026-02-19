---
task: posthog-issue-noise-hardening
timestamp_utc: 2026-02-19T13:14:13Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Hardening PostHog Noise Handling

## Objective

Reduce known noisy client-side exception telemetry while preserving actionable exception capture and current auth/product behavior.

## Success Criteria

- [x] Client error reporter cannot create unhandled promise rejections from telemetry POST failures.
- [x] Known noisy `Object Not Found Matching Id:* MethodName:update, ParamCount:4` exception is suppressed before sending to PostHog.
- [x] Suppression logic is covered by focused tests.
- [x] Lint/tests/typecheck pass for touched scope.

## Architecture & Components

- `lib/monitoring/clientReporter.ts`
  - Harden `send()` fetch error handling.
- `lib/posthog/provider.tsx`
  - Apply PostHog `before_send` filter with strict pattern checks.
- `lib/posthog/error-filter.ts` (new)
  - Centralize suppression predicate for testability and single source of truth.
  - Persist suppression debug counters/recent samples on `window` for easy DevTools inspection.
- `tests/lib/posthog/error-filter.test.ts` (new)
  - Verify positive/negative suppression cases and debug-state recording.

## Data Flow & API Contracts

- No endpoint contract changes.
- Internal telemetry flow only: browser -> PostHog SDK and `/api/client-error`.

## UI/UX States

- No UI state changes.

## Edge Cases

- Exception events with missing/invalid properties must never throw in filter logic.
- Similar but non-matching error messages must continue to be captured.

## Testing Strategy

- `pnpm exec eslint lib/posthog/provider.tsx lib/posthog/error-filter.ts lib/monitoring/clientReporter.ts tests/lib/posthog/error-filter.test.ts`
- `pnpm vitest tests/lib/posthog/error-filter.test.ts`
- `pnpm run typecheck`

## Rollout

- No feature flag required; deploy with normal release.
- Monitor PostHog issue volume for the filtered fingerprint after deploy.

## DB Change Plan (if applicable)

- Not applicable.

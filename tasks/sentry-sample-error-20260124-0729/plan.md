---
task: sentry-sample-error
timestamp_utc: 2026-01-24T07:29:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Sentry Sample Error Trigger

## Objective

We will add a safe, opt-in error trigger so the team can confirm Sentry captures Next.js errors.

## Success Criteria

- [ ] Invoking the trigger produces a Sentry issue with a stack trace.
- [ ] No existing user flows break or crash unexpectedly.

## Architecture & Components

- Update `src/app/sentry-example-page/page.tsx` button handler to call a nonexistent function.

## Data Flow & API Contracts

- No new API contracts; existing page already calls `/api/sentry-example-api`.

## UI/UX States

- Reuse existing button on the Sentry example page; no new UI states.

## Edge Cases

- Ensure trigger is opt-in and not executed on app load.

## Testing Strategy

- Manual: invoke the trigger and confirm Sentry issue appears.

## Rollout

- No feature flag; route is only used manually.

## DB Change Plan (if applicable)

- Not applicable.

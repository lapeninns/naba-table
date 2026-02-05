---
task: toast-revamp
timestamp_utc: 2026-02-05T12:48:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Toast Removal (Global)

## Objective

We will remove all toast notifications and the toast infrastructure so the app no longer relies on ephemeral alerts, while keeping core flows functional.

## Success Criteria

- [ ] No toast UI is rendered anywhere in the app.
- [ ] All toast calls and hooks are removed from runtime code.
- [ ] Tests and comments no longer reference toast utilities.
- [ ] Core ops and guest flows continue to function without toast dependencies.

## Architecture & Components

- Remove toast primitives and hook:
  - `components/ui/toast.tsx`
  - `components/ui/toaster.tsx`
  - `hooks/use-toast.ts`
- Remove toast usage across components/hooks/tests.

## Data Flow & API Contracts

- Remove `toast()` usage and toast-specific side effects.
- No API changes.

## UI/UX States

- No toast UI states.

## Edge Cases

- Removing toast feedback should not block critical flows.

## Testing Strategy

- Manual QA on `/app/dashboard` and one guest page to ensure flows still work without toasts.

## Rollout

- No feature flag (removal of notifications).
- Monitor ops feedback for missing user-facing feedback.

## DB Change Plan (if applicable)

- Not applicable.

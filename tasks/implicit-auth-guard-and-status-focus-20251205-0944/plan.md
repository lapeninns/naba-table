---
task: implicit-auth-guard-and-status-focus
timestamp_utc: 2025-12-05T09:44:00Z
owner: github:@ai-assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Fix implicit auth guard reset & GuestStatus focusability

## Objective

Ensure implicit magic-link logins can occur multiple times per session and restore focus management on guest status alerts for accessibility.

## Success Criteria

- Repeated implicit logins (sign out then open a new magic link) are processed without needing a hard reload.
- Status alert regains programmatic focus when `focusStatus()` is called (keyboard/SR users hear feedback).
- No duplicate hash processing or regressions in existing auth flows.

## Architecture & Components

- `components/auth/ImplicitAuthHandler`: keep module-level guard to prevent duplicate handling but reset `redirectInFlight` (and hash signature) after navigation/attempt; add cleanup to avoid stale state in persistent layouts.
- `src/components/guest/ui/GuestPrimitives.tsx` (`GuestStatus`): make wrapper focusable (e.g., `tabIndex={-1}`) while keeping role/aria attributes.

## Data Flow & API Contracts

- Tokens parsed from URL hash → `supabase.auth.setSession` → strip hash → redirect to `redirectedFrom` or default. No API changes.

## UI/UX States

- Status alert tones (success/error/info) unchanged; now focusable for announcements.

## Edge Cases

- Missing tokens: handler exits without redirect and clears guards for retry.
- Layout persistence: cleanup ensures guard resets even when component stays mounted across routes.
- Multiple handler instances: handled signature still blocks duplicate processing for same hash.

## Testing Strategy

- Manual: simulate implicit login twice in one session (sign out then open new magic link) to verify hash processing and redirect.
- Manual a11y: trigger status message and confirm focus moves to alert.
- Regression: quick smoke of existing auth sign-in flow.

## Rollout

- No feature flag. Ship directly once verified. Monitor auth error logs for anomalies.

## DB Change Plan

- Not applicable.

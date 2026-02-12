---
task: fix-posthog-provider-card-resize
timestamp_utc: 2026-02-04T18:23:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: PostHog Provider Stability + Booking Card Responsiveness

## Objective

We will prevent PostHog lazy-init from remounting the app tree and ensure booking cards adapt to viewport changes so ops workflows remain stable across resize/rotation.

## Success Criteria

- [ ] App subtree is not remounted when PostHog finishes initializing.
- [ ] Booking cards switch between mobile/desktop layouts on viewport change.
- [ ] Lint/typecheck remain clean.

## Architecture & Components

- `lib/posthog/provider.tsx`: keep `PHProvider` mounted with stable client reference.
- `src/components/features/dashboard/cards/OpsBookingCard.tsx`: add responsive media-query hook.

## Data Flow & API Contracts

- No API or contract changes.

## UI/UX States

- Mobile/desktop card layouts update on resize without losing actions.

## Edge Cases

- Ops host should continue to skip PostHog init.
- Mobile collapse state defaults remain unchanged.

## Testing Strategy

- Targeted lint/typecheck if needed.
- Manual UI QA via Chrome DevTools MCP (booking cards) if available.

## Rollout

- No feature flags; refactor-only change.

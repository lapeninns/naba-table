---
task: guest-typography-consistency
timestamp_utc: 2026-01-19T23:51:09Z
owner: github:@codex
reviewers: [github:@guest-experience]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Guest App Typography Consistency

## Objective

We will standardize guest app typography by using the existing guest theme utilities and aligning shared primitives with those utilities.

## Success Criteria

- [ ] Guest dashboard and profile headings use shared guest typography utilities.
- [ ] Guest primitives map to theme utilities and tokens.
- [ ] Typography hierarchy remains readable across breakpoints.

## Architecture & Components

- `styles/themes/guest-enhanced.css`: refine heading utilities (add balance wrap).
- `src/components/guest/ui/GuestPrimitives.tsx`: update Heading\* and TextBody to use theme utilities/tokens.
- `src/components/features/guest/dashboard/GuestDashboardClient.tsx`: replace ad-hoc hero heading classes with shared utilities.
- `src/components/features/guest/profile/GuestProfileClient.tsx`: replace ad-hoc heading classes with shared utilities.

## Data Flow & API Contracts

- No changes.

## UI/UX States

- No new states; typography alignment only.

## Edge Cases

- Narrow viewports with long headings.
- Dark mode token application.

## Testing Strategy

- Chrome DevTools MCP manual QA on guest dashboard/profile (320/375/768/1280).

## Rollout

- No feature flag; CSS/utilities only.

## DB Change Plan (if applicable)

- Not applicable.

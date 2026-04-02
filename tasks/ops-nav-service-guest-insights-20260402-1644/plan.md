---
task: ops-nav-service-guest-insights
timestamp_utc: 2026-04-02T16:45:54Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Ops Navigation Service and Guest & Insights Split

## Objective

We will regroup the staff sidebar navigation so operations users can scan pages faster by seeing service-execution pages separately from guest communication and analytics pages.

## Success Criteria

- [ ] Sidebar shows `Service` and `Guest & Insights` instead of the prior `Daily operations` grouping.
- [ ] All nav items keep their existing hrefs and active matching.
- [ ] `Restaurant Settings` remains unchanged.
- [ ] Manual sidebar QA confirms the new grouping renders correctly.

## Architecture & Components

- `src/components/features/ops-shell/navigation.tsx`: single source of truth for section labels and item grouping.

## Data Flow & API Contracts

- No API changes.

## UI/UX States

- Default sidebar view reflects the new section titles and item distribution.
- Feature-flagged `Rejections` remains conditionally visible.

## Edge Cases

- Root `/app` should still highlight Dashboard.
- Routes nested under `/app/bookings/*`, `/app/customers/*`, `/app/email-delivery*`, `/app/email-templates*`, and `/app/floor-plan*` must keep matching correctly.

## Testing Strategy

- Manual verification of sidebar section labels and item order.
- Run a lightweight code check on the edited file path.

## Rollout

- No feature flag or staged rollout required; this is a low-risk nav labeling change.

---
task: fix-review-findings
timestamp_utc: 2026-02-04T19:03:46Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Fix Review Findings

## Objective

We will remove state flicker in ops dashboard date handling, ensure replay is disabled on ops routes even after client-side navigations, and keep ops booking card markup consistent for hydration.

## Success Criteria

- [ ] `selectedDate` no longer resets when query params update without `date`.
- [ ] Replay is disabled when navigating into `/app` routes; resumes on non-ops routes when allowed.
- [ ] Ops booking cards hydrate without structural mismatches on mobile.

## Architecture & Components

- `src/components/features/dashboard/useOpsDashboardState.ts`: guard date updates.
- `src/instrumentation-client.ts`: route-aware replay gating.
- `src/components/features/dashboard/cards/OpsBookingCard.tsx`: stable media-query behavior.

## Data Flow & API Contracts

- No API changes.

## UI/UX States

- No new UI states; preserve existing behavior.

## Edge Cases

- Search/filter updates without `date` param should retain current date.
- Client-side navigations between ops and non-ops routes should toggle replay appropriately.
- Mobile rendering should match SSR on first paint.

## Testing Strategy

- Lint: `pnpm eslint --max-warnings=0 src/components/features/dashboard src/instrumentation-client.ts`
- Manual QA: verify ops dashboard date sticks when toggling filters/search.
- Manual QA: confirm replay disabled on ops route transition (devtools / Sentry debug logs if available).

## Rollout

- No feature flags.
- Monitor for Sentry replay activity on ops routes.

# Continuity Ledger

Last updated: 2026-04-02T16:45:54Z

## Goal (incl. success criteria)

- Split the ops sidebar's current daily-operations grouping into `Service` and `Guest & Insights`.
- Success: the nav renders the new section labels with the approved item grouping.
- Success: route destinations and active-state matching remain unchanged.

## Constraints/Assumptions

- Follow existing AGENTS SDLC flow with task artifacts.
- Keep the change scoped to the canonical ops navigation source in `src/components/features/ops-shell/navigation.tsx`.
- Manual Chrome DevTools verification is required because the sidebar UI changes.

## Key decisions

- Use the existing nav item definitions and only regroup them into new sections.
- Keep `Restaurant Settings` unchanged and preserve the existing `Rejections` feature-flag requirement.

## State

- Implementation and verification are complete for the ops navigation regrouping.

## Done

- Created task folder `tasks/ops-nav-service-guest-insights-20260402-1644/` with research/plan/todo/verification artifacts.
- Reviewed root and closest AGENTS guidance for the ops navigation change.
- Updated the canonical ops navigation source to split the old daily-operations group into:
- `Service`: Dashboard, Bookings, New Bookings, Floor Plan
- `Guest & Insights`: Guests, Email Delivery, Email Templates, Rejections
- Added a dev-only ops navigation harness for browser verification at `/dev/ops-navigation` and `/app/dev/ops-navigation`.
- Ran targeted ESLint checks on the touched files.
- Verified the rendered sidebar via Chrome DevTools with a clean console and captured a screenshot artifact.

## Now

- Prepare the final summary and note the temporary dev harness added for QA.

## Next

- If requested, keep or remove the dev-only navigation harness after broader ops-shell QA needs are known.

## Open questions (UNCONFIRMED if needed)

- None at the moment.

## Working set (files/ids/commands)

- `tasks/ops-nav-service-guest-insights-20260402-1644/research.md`
- `tasks/ops-nav-service-guest-insights-20260402-1644/plan.md`
- `tasks/ops-nav-service-guest-insights-20260402-1644/todo.md`
- `tasks/ops-nav-service-guest-insights-20260402-1644/verification.md`
- `tasks/ops-nav-service-guest-insights-20260402-1644/artifacts/`
- `CONTINUITY.md`
- `src/components/features/ops-shell/navigation.tsx`
- `src/app/(public)/dev/ops-navigation/page.tsx`
- `src/app/(public)/dev/ops-navigation/ui/OpsNavigationDevHarness.tsx`
- `src/app/app/dev/ops-navigation/page.tsx`

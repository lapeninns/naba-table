---
task: dashboard-ux-smoothing
timestamp_utc: 2026-02-03T23:23:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Dashboard UX/Performance Smoothing

## Objective

We will enable dashboard users to complete common ops tasks with immediate visual feedback, smooth scrolling, and stable layouts while reducing repeat waits and p95 latency spikes.

## Success Criteria

- [ ] Primary actions are visually consistent and obvious across dashboard pages.
- [ ] No layout shift during data loading; skeletons match final layout.
- [ ] Scroll stays smooth on heavy lists via virtualization.
- [ ] Prefetch/caching reduces repeat waits on common navigations.
- [ ] p95 interaction latency measured and improved on target flows.

## Architecture & Components

- Route-level loading: add `src/app/app/(app)/dashboard/loading.tsx` to render `DashboardSkeleton`.
- Toolbar: ensure search input uses clear placeholder + focus-visible styles.
- Header: replace `transition-all` with explicit property transitions for badges/buttons.
- Booking card header: add `id` for `aria-labelledby` linkage.
- LCP: render header with fallback summary data and defer summary section via dynamic import + skeleton fallback.
- TBT: avoid CollapsibleContent layout work on desktop cards; simplify virtual row measurement and avoid search index creation when idle; switch to element-based virtualization with internal scroll to reduce window scroll reflow.
- URL state: sync filter/search/sort params for shareability and back/forward consistency.

## Data Flow & API Contracts

- No API or data contract changes. React Query usage remains unchanged.

## UI/UX States

- Loading: route-level `loading.tsx` + `DashboardSkeleton`.
- Empty/Error/Success: unchanged; ensure a11y labels and stable layout.

## Edge Cases

- Ensure `aria-labelledby` targets exist for each card (unique IDs).
- Ensure URL sync does not break filter/date navigation or back/forward behavior.

## Testing Strategy

- Lint: `pnpm eslint --max-warnings=0 src/components/features/dashboard src/components/features/ops-shell components/dashboard`
- Typecheck: `pnpm typecheck`
- Manual QA: Chrome DevTools MCP on `/app/dashboard` (auth required).

## Rollout

- Feature flag: none (refactor-only UI changes).
- Exposure: 100% (no gating).
- Monitoring: watch console for a11y warnings; validate CLS stays stable.
- Kill-switch: revert via rollout if needed.

## DB Change Plan (if applicable)

- Target envs: staging → production (window: )
- Backup reference:
- Dry-run evidence: `artifacts/db-diff.txt`
- Backfill strategy:
- Rollback plan:

---
task: ops-bookings-performance-pass
timestamp_utc: 2026-03-29T16:28:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

Tool: Chrome DevTools MCP

### Console & Network

- [x] No new Console errors introduced by this change
- [x] Network requests match the public dev harness contract
- Notes:
- Existing baseline noise remains from PostHog debug/session tooling in dev; no new bookings-specific errors or warnings appeared after load or interaction.

### DOM & Accessibility

- [x] Semantic HTML verified on the bookings harness list surface
- [x] ARIA attributes correct for the visible list region/status updates
- [x] Focus order logical & visible on search and row actions
- [x] Keyboard-only flows succeed for search and button navigation in the verified path

### Performance (profiled; mobile; 4x CPU; 4G)

- Measured qualitatively in dev harness rather than Lighthouse because this pass focused on client render-path structure, not production bundle output.
- Concrete improvements shipped:
- row view models are now precomputed once per dataset/pending-action update instead of during visible-row render
- table action props are ID-based and narrower
- focused booking detail fetch/realtime subscription is skipped when the booking already exists in the active list
- realtime detail subscription console logging was removed
- Budgets met: [ ] Yes [x] Not formally measured in dev mode

### Device Emulation

- [ ] Mobile (≈375px)
- [ ] Tablet (≈768px)
- [x] Desktop (≥1280px)

## Test Outcomes

- `pnpm exec eslint --max-warnings=0 src/components/features/bookings/OpsBookingsClient.tsx src/components/features/bookings/opsBookingsSelectors.ts src/components/features/bookings/opsBookingsTypes.ts src/components/features/bookings/useOpsBookingsDataState.ts src/components/features/bookings/useOpsBookingsQueryState.ts src/components/features/bookings/useOpsBookingsState.ts src/hooks/ops/useOpsBooking.ts src/hooks/ops/useOpsBookingsDialogs.ts components/dashboard/BookingsTable.tsx src/app/'(public)'/dev/ops-bookings-list/ui/OpsBookingsListDevHarness.tsx tests/components/features/bookings/opsBookingsSelectors.test.ts`
- `pnpm exec vitest run tests/components/features/bookings/opsBookingsSelectors.test.ts`
- `pnpm exec tsc --noEmit`

## Artifacts

- Screenshot: `artifacts/ops-bookings-dev-harness.png`
- Notes:
- search interaction verified on `http://localhost:3000/dev/ops-bookings-list`
- details action still routes through the existing harness toast with no new runtime errors

## Known Issues

- Existing PostHog debug logs still appear in the dev console baseline.
- Lighthouse/perf-budget numbers were not captured because verification used the existing local dev server/harness rather than a production-like build.

## Sign-off

- [x] Engineering
- [ ] Design/PM
- [ ] QA

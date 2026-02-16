---
task: fix-ops-booking-edit-regression
timestamp_utc: 2026-02-16T13:21:23Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

- Route used: `http://localhost:3001/dev/ops-bookings?restaurantId=11111111-1111-4111-8111-111111111111`
- Verified:
  - Ops bookings view loads and edit dialog opens from `More actions -> Edit Booking`.
  - No crashes during dialog open with patched dashboard list code in build.
- Environment limitations (known harness noise):
  - Schedule/calendar-mask endpoints in harness returned `500`, so `Save changes` stayed disabled and full submit could not be completed in this harness run.
  - Realtime websocket DNS failures and unrelated hydration warning were present in local harness baseline.

## Telemetry Evidence (Pre-fix)

- Vercel logs (`last 15m`) show one ops edit failure:
  - `PATCH /api/ops/bookings/:id` -> `400` at `2026-02-16T13:18:57.671Z`
  - requestId: `zn25l-1771247937671-3e915bd9fa61`

## Automated Checks

- `pnpm vitest tests/components/OpsDashboardListUtils.test.ts` ✅
  - 1 file, 4 tests passed
- `pnpm vitest tests/hooks/useUpdateBooking.test.tsx` ✅
  - 1 file, 1 test passed
- `pnpm -s exec tsc --noEmit --pretty false` ✅
- `pnpm -s exec eslint src/components/features/dashboard/list/utils.ts src/components/features/dashboard/list/BookingsListVirtualized.tsx tests/components/OpsDashboardListUtils.test.ts` ✅

## Test Outcomes

- [x] Regression tests added and passing for timezone-aware `toIsoTime`.
- [x] Existing guest update hook test still passes.
- [x] Typecheck/lint for touched files pass.
- [ ] Full ops edit submit validation in dev harness (blocked by harness schedule API 500 responses).

## Artifacts

- `artifacts/vercel-logsv2-15m.jsonl`
- `artifacts/vercel-logsv2-400-15m.jsonl`
- `artifacts/vercel-logsv2-ops-failure.json`
- `artifacts/vercel-ops-400-summary.txt`
- `artifacts/posthog-mcp-status.txt`
- `artifacts/devtools-qa-notes.md`

## Known Issues

- PostHog MCP access blocked in-session by handshake error (`Unexpected content type`), so PostHog correlation could not be pulled via MCP.

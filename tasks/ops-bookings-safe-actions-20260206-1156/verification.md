---
task: ops-bookings-safe-actions
timestamp_utc: 2026-02-06T11:56:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Verification Report

## Automated

- [x] `pnpm lint` (0 errors; warnings exist in unrelated files)
- [x] `pnpm typecheck`
- [x] `pnpm vitest run`
- [x] `pnpm build`

## Manual QA — Chrome DevTools (MCP)

Tool: Chrome DevTools MCP

Pages used for manual QA (dev-only harnesses):

- `http://localhost:3000/dev/ops-bookings-list` (added to enable QA without auth)

Checks:

- [x] No-show from list requires confirm; confirm text includes guest + covers + time.
  - Verified dialog: `Mark as no-show?` includes guest name, covers, and time range.
- [x] Undo toast appears for 5s after marking no-show (toast action button present).
  - Toast shows `Marked no-show: <Guest>` with `Undo` action.
  - Note: this dev harness simulates the flow; production code uses the same toast/action pattern in `OpsBookingsClient.tsx`.
- [x] Check-in/out show success toast (dev harness simulates `Seat Guest` and `Finish` actions).
- [x] Per-booking pending behavior:
  - While one booking is pending, other bookings remain actionable (no global lifecycle lock).
- [x] No browser console errors attributable to these changes observed during harness verification.

Notes:

- The real `/app/bookings` route requires auth and redirected to `/app/auth/signin` in this environment, so a dev harness was used to validate the confirmation + toast UX.

## Artifacts

- Lighthouse (dev build; mobile form-factor): `artifacts/lighthouse-ops-bookings-list-mobile.json`
- Performance trace: `artifacts/dev-ops-bookings-list-trace.json.gz`
- Screenshots:
  - `artifacts/dev-ops-bookings-list-375.png`
  - `artifacts/dev-ops-bookings-list-768.png`
  - `artifacts/dev-ops-bookings-list-1280.png`
  - `artifacts/dev-ops-bookings-list-scrolled-sticky-375.png`
  - `artifacts/dev-ops-bookings-list-no-show-dialog-375.png`
  - `artifacts/dev-ops-bookings-list-no-show-toast-375.png`

# Continuity Ledger

Last updated: 2026-02-03T09:06:30Z

## Goal (incl. success criteria)

- Fix guest booking edit flow so email link works on a new device.
- Success: Public booking detail no longer throws `useOpsServices must be used within an OpsServicesProvider`.
- Success: Guest edit uses guest update API; ops edit continues via ops services.

## Constraints/Assumptions

- Follow AGENTS SDLC; task folder with artifacts.
- Chrome DevTools MCP QA required for UI changes.
- Keep changes minimal in legacy `components/` folder.

## Key decisions

- Dispatch `EditBookingDialog` into guest/ops subcomponents by `mode` to avoid ops hooks on guest routes.

## State

- Implementation complete; DevTools QA partially blocked by missing booking token/cookie.

## Done

- Refactored `EditBookingDialog` to use guest/ops mutations via separate subcomponents.
- Removed ops hook usage from guest booking detail.
- Created task artifacts and captured DevTools screenshot.

## Now

- Document QA limitations and finalize verification notes.

## Next

- Re-run DevTools MCP QA with a valid booking token/cookie when available.
- Update `verification.md` to complete remaining checks.

## Open questions (UNCONFIRMED if needed)

- None.

## Working set (files/ids/commands)

- `components/dashboard/EditBookingDialog.tsx`
- `tasks/fix-guest-booking-edit-dialog-20260203-0902/*`
- `tasks/fix-guest-booking-edit-dialog-20260203-0902/artifacts/auth-signin.png`

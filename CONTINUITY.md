# Continuity Ledger

Last updated: 2025-12-28T15:37:55Z

## Goal (incl. success criteria)

- Revamp booking-details UX/UI module per AGENTS SDLC and user specs, building on existing local changes.
- Success: New booking-details module structure with shadcn/ui, TS types/utils/hooks/components.
- Success: Tests for utils/hooks + BookingDialog smoke states.
- Success: Manual Chrome DevTools MCP QA recorded in verification.md.

## Constraints/Assumptions

- Follow AGENTS policy and SDLC; task folder required.
- Manual UI QA via Chrome DevTools MCP required for UI changes.
- Use shadcn/ui primitives (Radix) and repo Tailwind tokens.
- Secrets never in source.
- No coding before requirements and plan are reviewed.
- Proceed on top of existing local changes (user confirmed).

## Key decisions

- Use Sheet on mobile (bottom) and Dialog on desktop for BookingDialog layout.
- Treat booking time values as ISO strings in types; normalize to `Date` in utilities.
- Require confirmation before applying table assignment changes.
- Add sr-only Dialog/Sheet titles for accessibility compliance.

## State

- Added missing `useOpsTodayVIPs` hook file to resolve module-not-found. Manual Chrome DevTools QA still blocked because existing dev server instance on port 3000 is running older code and errors on `BookingAssignmentTabContent`.

## Done

- Read AGENTS policies and skills guidance.
- Located existing booking-details module and related files.
- Created task folder `tasks/booking-details-revamp-20251228-1429/` with research/plan/todo/verification stubs.
- Updated research/plan with dialog/sheet and time-type decisions.
- Implemented booking-details module, table assignment flow, and a11y titles.
- Fixed query invalidation to use ops dashboard summary key with `null` date.
- Added tests for utils/hooks/dialog; renamed utils test to `.test.tsx`.
- Ran targeted Vitest tests for booking-details (utils/hook/dialog) successfully.
- Restored `src/hooks/ops/useOpsTodayVIPs.ts` to satisfy hooks export.

## Now

- Coordinate with user to resolve dev server build error so Chrome DevTools QA can complete.

## Next

- Re-run Chrome DevTools MCP QA once dev server error is resolved.
- Update verification.md with QA results and artifacts.

## Open questions (UNCONFIRMED if needed)

- None.

## Working set (files/ids/commands)

- tasks/booking-details-revamp-20251228-1429/research.md
- tasks/booking-details-revamp-20251228-1429/plan.md
- tasks/booking-details-revamp-20251228-1429/todo.md
- tasks/booking-details-revamp-20251228-1429/verification.md
- src/components/features/dashboard/booking-details/BookingDialog.tsx
- src/components/features/dashboard/booking-details/
- tests/ops/booking-details-utils.test.tsx
- tests/ops/booking-details-hook.test.tsx
- tests/ops/booking-details-dialog.test.tsx
- CONTINUITY.md

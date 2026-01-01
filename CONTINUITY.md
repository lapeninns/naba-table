# Continuity Ledger

Last updated: 2026-01-01T11:50:13Z

## Goal (incl. success criteria)

- Allow ops admins to create bookings with email-only, phone-only, or both; at least one contact field required.
- Success: ops booking flow accepts email-only or phone-only without validation errors.
- Success: validation errors are accurate when both are missing or invalid.

## Constraints/Assumptions

- Follow AGENTS SDLC phases; no coding before requirements and plan are reviewed.
- Manual UI QA via Chrome DevTools MCP required for UI changes.
- Supabase remote-only if DB changes are needed.
- Secrets never in source.

## Key decisions

- Allow empty string emails in reservation schema to tolerate ops bookings with missing email.

## State

- Phase 3 (Implementation) in progress.

## Done

- Updated reservation schema to accept empty-string emails.
- Removed unused vars causing eslint warnings in ops reservation mutation.
- Replaced `any` cast in inline auto-assign payload with Json type.

## Now

- Re-run lint/commit checks; prepare verification.

## Next

- Manual QA via Chrome DevTools MCP for ops booking flow.
- Update `verification.md` with artifacts.

## Open questions (UNCONFIRMED if needed)

- Which ops booking entry points are in scope (wizard only vs other ops forms)? (UNCONFIRMED)
- Should phone validation remain UK-only for ops, or should ops accept international formats? (UNCONFIRMED)
- Should missing email be stored as null instead of empty string, and is that acceptable for downstream exports? (UNCONFIRMED)

## Working set (files/ids/commands)

- reserve/entities/reservation/reservation.schema.ts
- reserve/features/reservations/wizard/api/useCreateOpsReservation.ts
- src/services/inline-auto-assign.ts
- tasks/ops-booking-optional-contact-20260101-1143/verification.md

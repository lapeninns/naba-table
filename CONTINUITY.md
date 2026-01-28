# Continuity Ledger

Last updated: 2026-01-28T17:29:30Z

## Goal (incl. success criteria)

- Add ops-side booking CRUD email templates that clearly indicate actions performed on behalf of guests
- Success: Ops-created, ops-updated, and ops-cancelled emails use distinct subjects/templates
- Success: Email payloads include actor/source to select templates deterministically
- Success: Tests cover template selection/mapping

## Constraints/Assumptions

- Follow AGENTS.md SDLC phases; no coding before requirements and plan are reviewed
- Task artifacts required under `tasks/ops-booking-crud-email-20260128-1728/`
- No UI changes (Chrome DevTools MCP not required unless UI touched)
- No DB changes expected

## Key decisions

- TBD: how to represent ops vs guest action in email payloads (actor/source)

## State

- Phase 0 complete; starting Phase 1 requirements and code inventory

## Done

- Created task folder `tasks/ops-booking-crud-email-20260128-1728/` with stubs
- Read root, `server/AGENTS.md`, and `src/app/AGENTS.md`

## Now

- Inventory current booking email templates, queue payloads, and ops booking side-effects

## Next

- Clarify with user which CRUD events and copy differences are desired
- Fill `research.md` and `plan.md`
- Implement ops-specific template selection + tests

## Open questions (UNCONFIRMED if needed)

- Which CRUD events require distinct ops templates (create/update/cancel only, or all emails)? (UNCONFIRMED)
- Desired copy/subject wording for ops actions? (UNCONFIRMED)
- Should emails go only to guest or also to internal staff for ops actions? (UNCONFIRMED)

## Working set (files/ids/commands)

- `server/emails/bookings.ts`
- `server/jobs/booking-side-effects.ts`
- `server/queue/email.ts`
- `src/app/api/ops/bookings/route.ts`
- `src/app/api/ops/bookings/[id]/route.ts`
- `tasks/ops-booking-crud-email-20260128-1728/`

# Continuity Ledger

Last updated: 2026-04-02T15:12:00Z

## Goal (incl. success criteria)

- Fix the three reported restaurant email-template review findings on `codex/restaurant-email-template-management`.
- Success: repeated manual test sends deliver instead of being deduped by a static idempotency key.
- Success: saving one template key no longer overwrites unrelated concurrent template edits.
- Success: text/plain and HTML booking emails share the same CTA destination per template type.

## Constraints/Assumptions

- Follow existing AGENTS SDLC flow with task artifacts.
- Keep the fix scoped to canonical server email-template codepaths.
- No schema/API contract changes are required for this review follow-up.

## Key decisions

- Use a unique nonce-backed idempotency key for manual template test sends while leaving production send idempotency unchanged.
- Merge template updates onto the latest persisted restaurant document immediately before writing.
- Pass the resolved CTA URL into the plain-text renderer so HTML/text bodies stay aligned.

## State

- Phase 4 complete for the review follow-up; implementation, targeted regression tests, and typecheck are complete in the workspace.

## Done

- Created task folder `tasks/fix-email-template-review-findings-20260402-1402/` with research/plan/todo/verification stubs.
- Reviewed the root and closest AGENTS files for the touched areas.
- Confirmed the three reported findings by inspecting `server/emails/bookings.ts` and `server/restaurants/emailTemplates.ts`.
- Confirmed the existing targeted template route tests still pass and isolated the missing lower-level regression coverage.
- Updated manual template test sends to use nonce-backed idempotency keys.
- Updated booking email plain-text rendering to use the resolved CTA label and URL.
- Added a compare-and-swap retry flow around restaurant email-template document updates using `updated_at`.
- Added focused regression coverage in `tests/server/restaurant-email-templates.test.ts`.
- Verified targeted Vitest coverage and `pnpm typecheck` both pass.

## Now

- Ready to summarize the implemented fixes and verification results for the user.

## Next

- Optional follow-up only if requested: broaden concurrency protection for other JSON document update paths that still use read-modify-write semantics.

## Open questions (UNCONFIRMED if needed)

- None at the moment.

## Working set (files/ids/commands)

- `tasks/fix-email-template-review-findings-20260402-1402/research.md`
- `tasks/fix-email-template-review-findings-20260402-1402/plan.md`
- `tasks/fix-email-template-review-findings-20260402-1402/todo.md`
- `tasks/fix-email-template-review-findings-20260402-1402/verification.md`
- `tasks/fix-email-template-review-findings-20260402-1402/artifacts/`
- `CONTINUITY.md`
- `server/emails/bookings.ts`
- `server/emails/booking-template-support.ts`
- `server/restaurants/emailTemplates.ts`
- `tests/server/restaurant-email-template-routes.test.ts`
- `tests/server/restaurant-email-templates.test.ts`

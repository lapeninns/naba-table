# Continuity Ledger

Last updated: 2026-04-02T16:18:00Z

## Goal (incl. success criteria)

- Implement the broader email-template upgrade across the canonical ops/editor/server path.
- Success: booking email variants persist first-class `subject` and `preheader` fields.
- Success: token validation, richer preview surfaces, and stronger authoring guardrails land in the ops editor.
- Success: delivery metadata captures variant-level analytics details for later A/B inspection.
- Success: auth-email rendering is visually aligned with the shared email design system.

## Constraints/Assumptions

- Follow existing AGENTS SDLC flow with task artifacts.
- Keep the change scoped to canonical email-template codepaths rather than the legacy settings replica.
- Prefer compatibility through domain normalization instead of a database migration.

## Key decisions

- Extend the variant model itself with `subject` and `preheader` instead of deriving subject from `headline` alone.
- Reuse the existing `email_delivery_log.metadata` JSON for variant analytics instead of introducing a new table change.
- Keep the shared `renderEmailBase` shell as the brand source of truth and align auth-email content onto it.

## State

- Implementation, targeted verification, and task evidence are complete for the email-template upgrade.

## Done

- Created task folder `tasks/email-template-upgrades-20260402-1449/` with research/plan/todo/verification stubs.
- Reviewed the root and closest AGENTS files for `lib/`, `server/`, `src/components/`, and `src/app/`.
- Confirmed the current gaps in subject/preheader editing, token guidance, preview depth, auth-email brand drift, and variant analytics.
- Extended restaurant email template variants with persisted `subject` and `preheader` fields plus token/duplicate guardrails.
- Updated ops template DTOs, preview/test-send routes, and booking-email rendering to expose subject, preheader, selected variant name, and variant analytics metadata.
- Rebuilt the ops editor and preview panes with field counters, variable chips, authoring hints, plain-text preview, CTA destination display, and variant badges in delivery surfaces.
- Aligned the auth magic-link email body styling with the shared email shell and refreshed targeted tests.
- Completed browser QA on the dev harness, captured screenshots/Lighthouse/performance artifacts, and updated task verification records.

## Now

- Prepare the final user summary and any follow-up notes from the completed verification pass.

## Next

- If requested, stage the diff for review or break the implementation into a PR-ready change summary.

## Open questions (UNCONFIRMED if needed)

- None at the moment.

## Working set (files/ids/commands)

- `tasks/email-template-upgrades-20260402-1449/research.md`
- `tasks/email-template-upgrades-20260402-1449/plan.md`
- `tasks/email-template-upgrades-20260402-1449/todo.md`
- `tasks/email-template-upgrades-20260402-1449/verification.md`
- `tasks/email-template-upgrades-20260402-1449/artifacts/`
- `CONTINUITY.md`
- `lib/restaurants/email-templates.ts`
- `src/app/api/ops/restaurants/schema.ts`
- `server/emails/bookings.ts`
- `server/emails/base.ts`
- `server/auth/magic-link-email.ts`
- `src/services/ops/restaurants.ts`
- `src/hooks/ops/useOpsEmailTemplatesPageState.ts`
- `src/components/features/email-templates/EmailTemplatesEditorPane.tsx`
- `src/components/features/email-templates/EmailTemplatesPreviewPane.tsx`
- `server/emails/bookings.ts`
- `server/emails/email-delivery-log.ts`
- `tests/lib/restaurant-email-templates.test.ts`
- `tests/server/restaurant-email-template-routes.test.ts`
- `tests/server/restaurant-email-templates.test.ts`

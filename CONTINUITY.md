# Continuity Ledger

Last updated: 2026-04-04T09:50:00Z

## Goal (incl. success criteria)

- Extend the existing email template system so relevant guest emails can prime photo-taking before a visit and ask for reviews afterward.
- Success: add the fields to the canonical template model, render path, preview/test-send flows, and ops UI without cluttering the short reminder template, then upgrade the default copy catalog for stronger conversion.

## Constraints/Assumptions

- Follow existing AGENTS SDLC flow with task artifacts.
- Recommendations and implementation should stay aligned with the current canonical email flow and not invent unsupported owner-facing behavior.
- `reminder_short` should remain operational, not persuasive.

## Key decisions

- Treat the existing `review_request` template as a guest-facing, post-visit review collection tool.
- Add optional `cue` and `ask` variant fields instead of overloading existing copy fields with hidden semantics.
- Use `cue` on pre-visit templates and `ask` on the post-visit review template.
- Keep `reminder_short` unchanged.
- Improve the built-in copy toward clearer, lower-friction transactional messaging.

## State

- Implementation and catalog rewrite are complete; ready to summarize the shipped copy upgrade.

## Done

- Reviewed root `AGENTS.md`, `src/services/ops/AGENTS.md`, and `server/AGENTS.md`.
- Loaded the repo-local `nabatable-task-harness` skill.
- Created task folder `tasks/eeat-review-template-strategy-20260403-1633/` with `research.md`, `plan.md`, `todo.md`, `verification.md`, and `artifacts/`.
- Inspected template definitions in `lib/restaurants/email-templates.ts`.
- Inspected review scheduling and send logic in `server/jobs/booking-side-effects.ts` and `server/emails/bookings.ts`.
- Added `cue` and `ask` fields to the template variant model, sanitization path, preview routes, test-send routes, and render helpers.
- Updated the ops template editor and preview surfaces to show `Photo cue` and `Review ask` on the relevant templates only.
- Added targeted unit/server test coverage and passed TypeScript no-emit validation.
- Verified the dev harness in Chrome DevTools MCP and captured screenshots in the task artifacts folder.
- Audited the live default copy and identified the need for stronger subjects plus more variants on the thinner templates.
- Split the large default catalog into `lib/restaurants/email-template-defaults.ts` to bring `lib/restaurants/email-templates.ts` back under the repo line-count guardrail.
- Rewrote the default subject, preheader, headline, intro, cue, and ask copy for stronger clarity and lower-friction conversion.
- Expanded thin templates like request received, change flows, cancellations, and arrival reminders to three built-in variants each.
- Re-ran the targeted TypeScript and Vitest checks successfully and refreshed browser artifacts for the updated copy.

## Now

- Summarize the copy improvements, the new variant coverage, and any remaining follow-up ideas for the user.

## Next

- If needed, tune the default copy further or add analytics around field adoption.

## Open questions (UNCONFIRMED if needed)

- None.

## Working set (files/ids/commands)

- `tasks/eeat-review-template-strategy-20260403-1633/research.md`
- `tasks/eeat-review-template-strategy-20260403-1633/plan.md`
- `tasks/eeat-review-template-strategy-20260403-1633/todo.md`
- `tasks/eeat-review-template-strategy-20260403-1633/verification.md`
- `CONTINUITY.md`
- `lib/restaurants/email-templates.ts`
- `server/jobs/booking-side-effects.ts`
- `server/emails/bookings.ts`
- `components/ops/restaurants/RestaurantDetailsForm.tsx`
- `src/components/features/restaurant-settings/EmailTemplatesSection.tsx`
- `src/components/features/email-templates/EmailTemplatesEditorPane.tsx`
- `src/components/features/email-templates/EmailTemplatesPreviewPane.tsx`
- `src/app/api/ops/restaurants/schema.ts`
- `tests/lib/restaurant-email-templates.test.ts`
- `tests/server/restaurant-email-template-routes.test.ts`
- `tests/server/restaurant-email-templates.test.ts`
- `lib/restaurants/email-template-defaults.ts`

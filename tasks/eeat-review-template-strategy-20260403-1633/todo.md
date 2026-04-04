---
task: eeat-review-template-strategy
timestamp_utc: 2026-04-03T16:33:00Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Review AGENTS.md policies and relevant nested AGENTS files.
- [x] Inspect the booking email template definitions.
- [x] Inspect the ops settings surfaces for template editing, preview, and test-send flows.
- [x] Audit the current default copy for clarity, friction, and conversion gaps.

## Core

- [x] Add optional `cue` / `ask` fields to the template variant shape, sanitization, and defaults.
- [x] Thread `cue` / `ask` through preview, test-send, and runtime render helpers.
- [x] Preserve the existing review CTA routing and short-reminder intent.
- [x] Rewrite default subjects, headlines, intros, and cue/ask copy where needed.
- [x] Add more built-in variants to the thinner templates.

## UI/UX

- [x] Add template-specific inputs for `Photo cue` and `Review ask`.
- [x] Show the new fields in the preview summary and rendered preview content.
- [x] Keep `reminder_short` free of extra persuasion UI.
- [x] Sanity-check that the revised copy still reads cleanly in preview.

## Tests

- [x] Template unit tests updated.
- [x] Server preview/test-send tests updated.
- [x] `pnpm exec tsc --noEmit --pretty false`
- [x] `pnpm exec vitest run tests/lib/restaurant-email-templates.test.ts tests/server/restaurant-email-templates.test.ts tests/server/restaurant-email-template-routes.test.ts`
- [x] Chrome DevTools MCP manual verification on `/dev/ops-email-templates`
- [x] Re-run targeted tests after the catalog rewrite.

## Notes

- Assumptions:
  - `cue` should stay soft and pre-visit.
  - `ask` should stay direct and post-visit.
- Deviations:
  - The task began as research and expanded into implementation after the follow-up request.

## Batched Questions

- None.

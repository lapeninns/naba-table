---
task: eeat-review-template-strategy
timestamp_utc: 2026-04-03T16:33:00Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: low
flags: []
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

Tool: Chrome DevTools MCP

### Dev Harness

- Verified against `http://localhost:3002/dev/ops-email-templates` on a fresh local dev server.

### Console & Network

- [x] No console errors while switching between `confirmation`, `review_request`, and `reminder_short`.
- [x] Preview requests completed successfully with the new `cue` / `ask` fields.

### UI Behavior

- [x] `confirmation` shows a `Photo cue` field and preview output.
- [x] `review_request` shows a `Review ask` field and preview output.
- [x] `reminder_short` does not show either field.
- [x] Plain-text and rendered HTML previews include the new content where applicable.
- [x] Each template group now exposes a fuller default variant set in the editor, with thinner templates expanded to three variants.
- [x] Revised subject, preheader, headline, and body copy reads cleanly in the editor for confirmation, review, and arrival reminder templates.

## Test Outcomes

- [x] `pnpm exec tsc --noEmit --pretty false`
- [x] `pnpm exec vitest run tests/lib/restaurant-email-templates.test.ts tests/server/restaurant-email-templates.test.ts tests/server/restaurant-email-template-routes.test.ts`
- [x] 16 targeted tests passed.

## Artifacts

- Screenshots:
  - `artifacts/confirmation-photo-cue.png`
  - `artifacts/confirmation-copy-refresh.png`
  - `artifacts/review-ask.png`
  - `artifacts/review-copy-refresh.png`

## Known Issues

- Restaurant review email preferences are still present in payload/schema/form surfaces, but current server scheduling logic forces guest email preferences to always enabled.

## Sign-off

- [x] Engineering
- [ ] Design/PM
- [ ] QA

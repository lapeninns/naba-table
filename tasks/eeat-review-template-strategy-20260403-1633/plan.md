---
task: eeat-review-template-strategy
timestamp_utc: 2026-04-03T16:33:00Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: EEAT Review Template Strategy

## Objective

We will extend the booking email template system with optional `cue` and `ask` fields, then rewrite the default variant catalog for higher-converting transactional copy without changing the underlying CTA flow.

## Success Criteria

- [x] Add `cue` and `ask` to the template variant model and sanitization path.
- [x] Expose the new fields in the ops editing and preview surfaces only for relevant templates.
- [x] Include the fields in preview/test-send/render output so operators can validate the copy before saving.
- [x] Keep `reminder_short` free of the new persuasion fields.
- [x] Improve default subject, headline, intro, and cue/ask copy across the catalog.
- [x] Add additional default variants to thinner templates where more operator choice is valuable.

## Architecture & Components

- `server/emails/bookings.ts`: resolves review CTA destination and renders the outbound message.
- `server/emails/booking-template-support.ts`: generates plain-text support output for previews and test sends.
- `lib/restaurants/email-templates.ts`: defines the review template variants and authoring constraints.
- `src/app/api/ops/restaurants/schema.ts`: validates template payloads and preview responses.
- `src/components/features/email-templates/EmailTemplatesEditorPane.tsx`: shows template-specific `cue` / `ask` authoring inputs.
- `src/components/features/email-templates/EmailTemplatesPreviewPane.tsx`: shows the new fields in the preview summary.
- `src/components/features/restaurant-settings/EmailTemplatesSection.tsx`: persists the extra fields through settings state.
- The default catalog may need explicit `subject` / `preheader` defaults instead of deriving them from `headline` / `intro`.

## Data Flow & API Contracts

- Ops edit -> schema validation -> preview/test-send route -> shared renderer/interpolator -> saved template variants used at send time.
- Guest runtime CTA flow remains unchanged:
  - `review_request` still points to `googleReviewUrl` or existing fallbacks.

## UI/UX States

- Relevant templates show one extra optional field:
  - `Photo cue` on `confirmation` and `reminder_24h`
  - `Review ask` on `review_request`
- `reminder_short` and unrelated templates do not show extra controls.

## Edge Cases

- If `googleReviewUrl` is missing, review CTA still falls back to `googleMapUrl` and then to an internal reviews URL.
- Legacy template payloads without `cue` / `ask` must remain valid.
- Unknown template tokens in the new fields should be surfaced consistently with the existing editor validation.
- Expanding default variant counts must not break deterministic selection or reset-to-default behavior.

## Testing Strategy

- Update unit coverage for template sanitization/defaults/signatures.
- Update server tests for preview/test-send payloads and rendered output.
- Run TypeScript no-emit validation.
- Run Chrome DevTools MCP against the dev harness to verify the editor and preview behavior.
- Verify that the richer default catalog still appears correctly in the editor and reset flows.

## Rollout

- Ship as part of the existing ops email template editor with no migration required.

## DB Change Plan (if applicable)

- No DB changes.

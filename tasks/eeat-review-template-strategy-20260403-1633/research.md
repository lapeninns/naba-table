---
task: eeat-review-template-strategy
timestamp_utc: 2026-04-03T16:33:00Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: low
flags: []
related_tickets: []
---

# Research: EEAT Review Template Strategy

## Requirements

- Functional:
  - Inspect the current guest email flow and identify where the existing review template is used.
  - Determine whether pre-visit and post-visit templates need new configurable fields to prime photo-taking and ask for reviews.
  - Add any required template fields across the canonical editor, preview, API, and render paths.
  - Rewrite the default template catalog for stronger conversion while keeping each email aligned to its transactional intent.
  - Add extra default variants where the current catalog is too thin to support meaningful tone testing.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Preserve the current guest-facing email contract and avoid misusing a guest template for owner/admin outreach.
  - Keep short operational reminders uncluttered so arrival-time emails remain focused on logistics.

## Existing Patterns & Reuse

- Guest booking emails are centrally rendered in `server/emails/bookings.ts`.
- Restaurant-specific variants live in `lib/restaurants/email-templates.ts` and are managed from the ops settings UI.
- Review requests are already part of the booking lifecycle and are scheduled after a visit completes.
- Restaurant profile data includes `googleReviewUrl`, which is the primary review CTA destination.
- Template variant fields already support structured content like `subject`, `preheader`, `headline`, `intro`, and `ctaLabel`, so extending the same shape is the most direct path.
- The existing default catalog is uneven: some templates already have three variants, while several operational templates still have only one.

## External Resources

- None. This was a repo-local flow inspection.

## Constraints & Risks

- The `review_request` template is designed for guests after a completed visit, not for restaurant operators.
- The review CTA destination for `review_request` is resolved in code, so copy can change but the underlying intent remains "leave a review".
- Restaurant-level email preference toggles for review requests still exist in DTOs/forms, but current job logic forces guest emails on.
- Any new persuasion field must be optional and template-specific so `reminder_short` stays purely operational.
- Conversion improvements should favor clarity, certainty, and low-friction asks over generic hospitality phrasing.

## Open Questions (owner, due)

- Q: Do we want an owner-facing lifecycle email or task prompt for "add photos / add review link / publish profile"?
  A: Open. That would need a separate template or notification path.

## Recommended Direction (with rationale)

- Extend template variants with two optional fields:
  - `cue`: a soft pre-visit priming line for templates like `confirmation` and `reminder_24h`
  - `ask`: a direct post-visit ask for templates like `review_request`
- Populate defaults only where the message intent matches:
  - `confirmation` and `reminder_24h` get `cue`
  - `review_request` gets `ask`
  - `reminder_short` stays empty
- Reuse the existing template editing and preview workflow rather than inventing a separate email type.
- Improve default subjects and intros to lead with certainty and the guest's next action.
- Expand thin templates with additional high-quality variants so operators have stronger built-in copy options without writing from scratch.

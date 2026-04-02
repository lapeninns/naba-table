---
task: email-template-upgrades
timestamp_utc: 2026-04-02T14:49:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Email Template Upgrades

## Requirements

- Functional:
  - Make booking email `subject` and `preheader` editable as first-class template fields.
  - Add token validation and clearer token insertion guidance in the ops email-template editor.
  - Upgrade the live preview to expose delivery-relevant fields beyond HTML alone.
  - Record variant-level metadata so A/B template performance can be inspected after sends.
  - Bring auth-email rendering closer to the shared booking-email design system.
  - Add authoring guardrails that reduce low-signal or duplicate variants.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Keep API validation strict at route boundaries.
  - Preserve deterministic email rendering and retry safety.
  - Avoid leaking secrets or raw database errors.
  - Keep editor feedback accessible with inline copy, labels, and non-color-only cues.

## Existing Patterns & Reuse

- Booking email template editing already uses a canonical catalog and per-restaurant override document in `lib/restaurants/email-templates.ts`.
- Ops routes already validate template payloads in `src/app/api/ops/restaurants/schema.ts`.
- Booking email preview and sending already flow through `server/emails/bookings.ts`.
- Shared email shell and CTA rendering already live in `server/emails/base.ts`.
- Auth magic-link email already uses the shared shell, but its body styling remains separately authored in `server/auth/magic-link-email.ts`.
- Delivery logging already stores JSON metadata, which can hold variant analytics without a schema migration.

## External Resources

- None required; the work stays inside the repo's current stack and patterns.

## Constraints & Risks

- Existing stored restaurant template documents are versioned and include only variant-level copy fields today, so new fields must normalize safely from legacy records.
- The editor and preview have both an older restaurant-settings path and the newer ops command-center path; changes should land on the canonical newer path first and preserve service contracts used by both.
- Variant analytics should not break existing delivery dashboards that aggregate by `templateType`.
- UI verification is required after the UI changes.

## Open Questions (owner, due)

- Q: Should variant analytics include only the variant id, or also the rendered subject/headline snapshot for historical inspection?
  A: Include both in metadata so later analysis can group by id and still inspect what was actually sent.

## Recommended Direction (with rationale)

- Extend the variant model with `subject` and `preheader`, keep `headline` as the body hero/title, and continue interpolating all user-facing text through the same variable resolver.
- Add route-level token linting and duplicate-variant guardrails so bad drafts fail early and explain why.
- Expand preview payload consumption in the UI to show rendered subject, preheader, plain text, CTA URL, and selected variant details.
- Record variant id, variant name, and rendered subject/headline into delivery-log metadata so A/B analysis becomes possible without a new table migration.
- Reuse `renderEmailBase` and the booking email visual language in auth flows to reduce brand drift.

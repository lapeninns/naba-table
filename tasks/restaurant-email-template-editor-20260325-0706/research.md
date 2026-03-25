---
task: restaurant-email-template-editor
timestamp_utc: 2026-03-25T07:08:18Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Restaurant-managed email template editor

## Requirements

- Functional:
  - Allow each restaurant to customize booking email copy from the Ops settings surface.
  - Provide a visual editing experience that feels closer to a Mailchimp-style editor than raw JSON editing.
  - Restrict customization to approved sections only; the core email shell, layout, CTA routing, delivery logic, logging, and compliance footer must remain system-controlled.
  - Support preview before save and reset-to-default per template.
  - Preserve merge tags/variables in supported fields.
- Non-functional:
  - Accessibility: keyboard-accessible editor, clear locked/editable affordances, preview usable with screen readers.
  - Security: no arbitrary HTML injection, no unsafe links/scripts/styles.
  - Reliability: invalid template configs must never break sends; runtime falls back to defaults.
  - Maintainability: single source of truth for allowed template keys, editable regions, defaults, and variable lists.

## Existing Patterns & Reuse

- Restaurant settings already exist in the Ops app and are routed through `OpsRestaurantSettingsClient`.
- Restaurant profile/settings data already flows through typed route handlers and service-layer DTOs.
- `restaurants.email_templates` already exists as a JSONB column and is read by booking email rendering.
- Current booking email customization is partial only:
  - Per-restaurant overrides are fetched from `restaurants.email_templates`.
  - Only `headline` and `intro` are currently overrideable.
  - The full HTML shell is rendered by code in `server/emails/bookings.ts`.
- Current booking templates are rendered centrally in `server/emails/bookings.ts`, which is the right canonical place to keep the locked shell and delivery invariants.

## Current Technical Reality

- Booking/ops emails are system-rendered and sent through Resend.
- Template override lookup today is `venue.emailTemplates?.[ctx.type]`.
- Supported runtime variants currently include:
  - `created`
  - `cancelled`
  - `modification_pending`
  - `modification_confirmed`
  - `booking_rejected`
  - `restaurant_cancellation`
  - `review_request`
  - `reminder`
  - `reminder_short`
  - `pending_attention`
- Queue job types differ slightly from renderer variants:
  - `request_received`
  - `confirmation`
  - `updated`
  - `cancelled`
  - `reminder_24h`
  - `reminder_short`
  - `review_request`
  - `booking_rejected`
  - `restaurant_cancellation`

## Gaps / Risks

- The current `created` renderer serves two different moments:
  - pending request received
  - immediately confirmed booking
    This is too coarse for restaurant-managed editing and should be modeled as separate editable variants.
- A free-form HTML editor would let restaurants break structure, remove critical actions, or introduce unsafe markup.
- `email_templates` is currently effectively untyped at runtime and in the generated DB types.
- There is no restaurant settings route or UI section for email templates yet.
- `pending_attention` is an internal/operator-facing template and should not be part of restaurant self-serve customization in phase 1.
- Auth templates are a separate system:
  - some are documented for manual Supabase dashboard setup
  - sign-in/signup magic-link emails are sent from app code
    These should stay out of this restaurant settings scope.

## External Resources

- Mailchimp-style expectation from user:
  - Visual editor UX is desirable.
  - Full arbitrary HTML editing is not acceptable for this product because core sections must remain locked.

## Recommended Direction (with rationale)

- Build a constrained visual template editor, not a raw HTML editor.
- Keep the canonical shell in code and expose only approved slots/blocks, for example:
  - preheader
  - headline
  - intro/body paragraphs
  - optional secondary note
  - CTA label override where safe
  - review/reminder-specific helper copy
- Store restaurant customizations as a typed JSON document inside `restaurants.email_templates`, versioned and validated.
- Introduce a central template catalog describing:
  - editable template keys
  - default content
  - allowed variables
  - locked vs editable regions
  - preview sample data
- Limit phase 1 to restaurant-facing booking emails only. Exclude auth emails and internal ops alerts.

## Open Questions (owner, due)

- Q: Should restaurants be allowed to override CTA button labels for all template types, or only selected ones?
  A: Proposed default is "selected ones only" where destination semantics remain clear. Owner: implementation. Due: during plan finalization.
- Q: Should restaurants be able to insert rich-text emphasis, lists, and dividers, or only plain text fields?
  A: Proposed default is a curated rich-text subset rendered from structured blocks. Owner: implementation. Due: UI design phase.
- Q: Should the first release support per-language variants?
  A: Proposed default is no; design schema so localization can be added later without breaking storage. Owner: product/engineering. Due: before implementation.

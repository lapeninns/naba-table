---
task: restaurant-email-template-management
timestamp_utc: 2026-04-01T19:36:44Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Research: Restaurant email template management

## Requirements

- Functional:
  - Add a new restaurant settings screen for managing per-restaurant booking email template copy.
  - Support grouped template browsing, per-template variant management, preview, reset, and test-send.
  - Keep the system email shell and delivery behavior locked while allowing restaurant-level copy overrides.
- Non-functional:
  - Accessibility for gallery, variant editor, and preview.
  - Deterministic runtime rotation across active variants.
  - Strong validation and fallback behavior so invalid overrides cannot break sends.

## Existing Patterns & Reuse

- Restaurant settings shell, routing, and sections already exist under `src/components/features/restaurant-settings`.
- Restaurant data already flows through typed ops API routes, services, and React Query hooks.
- Booking email rendering is centralized in `server/emails/bookings.ts` and already reads `restaurants.email_templates`.
- Dev harness support exists for restaurant settings in `src/app/(public)/dev/ops-settings-restaurant`.

## Constraints & Risks

- `restaurants.email_templates` is still typed as generic JSON in generated DB types.
- Existing runtime overrides only support `headline` and `intro`; the new variant model must remain backward compatible or normalize old data.
- UI work must stay aligned with the existing restaurant settings visual language.
- Test-send needs guardrails so it does not alter real delivery routing behavior.

## Recommended Direction

- Introduce a shared booking email template catalog with system defaults, grouping metadata, editable fields, and preview helpers.
- Persist versioned restaurant override documents in `restaurants.email_templates`.
- Add dedicated nested ops routes for template CRUD, preview, and test-send.
- Build the UI as a new restaurant settings view using the existing settings shell and service stack.

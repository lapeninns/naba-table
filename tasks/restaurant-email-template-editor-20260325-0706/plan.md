---
task: restaurant-email-template-editor
timestamp_utc: 2026-03-25T07:08:18Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Restaurant-managed email template editor

## Objective

We will let restaurant owners/admins customize approved portions of booking emails from restaurant settings so that each venue can tailor guest-facing messaging without being able to alter the core email shell, delivery rules, or compliance-critical structure.

## Success Criteria

- [ ] Restaurant owners/admins can edit approved email template content from Ops settings.
- [ ] The system validates and persists template configs safely per restaurant.
- [ ] All booking emails continue to render from the locked code-owned shell.
- [ ] Invalid or missing customizations always fall back to system defaults.
- [ ] Restaurants can preview each template with sample booking data before saving.
- [ ] Internal-only templates remain non-editable.

## Scope

- In scope:
  - Restaurant-facing booking email templates
  - Ops settings UI for editing and previewing
  - API/schema/service updates
  - Runtime renderer updates to consume typed template config
- Out of scope for phase 1:
  - Supabase auth email templates
  - app-generated auth magic-link emails
  - invitation emails
  - full arbitrary HTML source editing
  - localization/multi-language variants

## Template Model

- Canonical template catalog lives in server/shared code.
- Each editable template definition includes:
  - `key`
  - `label`
  - `description`
  - `audience`
  - `defaultContent`
  - `allowedVariables`
  - `editableFields`
  - `previewFixture`
- Editable template keys for phase 1:
  - `request_received`
  - `confirmation`
  - `modification_pending`
  - `modification_confirmed`
  - `cancelled`
  - `booking_rejected`
  - `restaurant_cancellation`
  - `review_request`
  - `reminder_24h`
  - `reminder_short`
- Non-editable keys:
  - `pending_attention`
  - auth-related templates

## Data Model

- Reuse `restaurants.email_templates` as storage to avoid a new table unless versioning/history requirements force one later.
- Formalize the JSON shape:
  - `version`
  - `templates`
  - each template contains only allowed editable fields
- Example shape:

```json
{
  "version": 1,
  "templates": {
    "confirmation": {
      "headline": "You're booked at {{venue}}",
      "intro": "Hi {{firstName}}, your table is confirmed for {{date}} at {{time}}.",
      "blocks": [{ "type": "paragraph", "content": "Please let us know if your plans change." }],
      "ctaLabel": "Manage booking"
    }
  }
}
```

- Validation rules:
  - reject unknown template keys
  - reject unknown fields
  - reject disallowed block types
  - enforce max lengths per field/block
  - sanitize text content
  - enforce allowed merge tags only

## Rendering Strategy

- Keep HTML generation in `server/emails/bookings.ts`.
- Replace ad hoc `headline`/`intro` override lookup with a typed resolver:
  - start from catalog defaults
  - apply validated restaurant overrides
  - render approved blocks into the locked shell
- Keep these core elements non-customizable:
  - outer layout/shell
  - logo/header structure
  - booking summary card
  - action URL destinations
  - support/manage/help links
  - ICS attachment behavior
  - email logging metadata
  - retry / dedupe behavior

## API & Service Changes

- Extend restaurant DTOs and update schema to include `emailTemplates`.
- Add typed server validation in:
  - `src/app/api/ops/restaurants/schema.ts`
  - `server/restaurants/update.ts`
  - restaurant service DTO mapping
- Ensure PATCH only accepts validated template payloads.
- Consider a dedicated nested endpoint if payload size makes profile PATCH too broad:
  - preferred: `PATCH /api/ops/restaurants/[id]/email-templates`
  - fallback: extend existing restaurant PATCH if staying simple

## UI / UX

- Add a new restaurant settings route:
  - `/settings/restaurant/email-templates`
- Build a dedicated section rather than crowding the profile screen.
- UI shape:
  - template list/sidebar
  - status badge: default/customized
  - editor panel
  - live desktop/mobile email preview
  - supported merge tag helper
  - reset-to-default action
  - save / unsaved-state handling
- Editing model:
  - Mailchimp-like visual composition feel
  - structured blocks and rich text controls
  - explicit “locked” panels for non-editable sections
  - no raw HTML source editing in phase 1

## Allowed Customization

- Editable:
  - headline
  - intro
  - selected body paragraphs / note blocks
  - selected CTA label fields
  - optional review/reminder helper note
- Locked:
  - shell HTML
  - colors and global layout
  - booking facts module
  - CTA destinations
  - footer/support/compliance framing
  - operational/internal templates

## Edge Cases

- Restaurant has no customization saved.
- Restaurant saved old schema version.
- Template payload is partially invalid.
- Merge tag removed or typoed by user.
- Reminder variants diverge significantly from standard copy.
- Booking status maps to a template key that should not be restaurant-editable.
- Concurrent edits from multiple admins.

## Testing Strategy

- Unit:
  - template catalog validation
  - merge tag validation
  - renderer fallback behavior
  - block-to-HTML renderer
- Integration:
  - ops API validation and persistence
  - restaurant service mappings
  - email rendering with custom + default content
- UI:
  - editor state, reset, preview, save
  - permission gating for viewer/staff vs owner/admin
- E2E:
  - edit template, preview, save, reload
  - send path uses saved template
- Accessibility:
  - keyboard-only editing
  - preview labels and structure
  - form error announcement

## Rollout

- Phase 1: behind a feature flag for selected restaurants/admins.
- Phase 2: enable for all owner/admin roles after QA and content review.
- Monitoring:
  - template validation failures
  - fallback-to-default count
  - save success/failure telemetry
  - send/render failures by template key
- Kill switch:
  - disable editor route
  - ignore restaurant overrides at render time and use defaults only

## Migration / Data Plan

- No new table required initially.
- Add generated types / validation coverage for `email_templates`.
- Optional backfill:
  - normalize any existing `headline`/`intro` overrides into the new `version: 1` shape
  - map current `created` overrides into `request_received` and `confirmation` carefully, or leave them on default and require manual migration if ambiguity is too high

## Implementation Order

1. Define central template catalog and schema.
2. Add server-side validation and typed persistence.
3. Update runtime renderer to consume catalog + overrides.
4. Add ops API/service support.
5. Build restaurant settings route + editor UI + preview.
6. Add tests.
7. Run UI QA in Chrome DevTools MCP and capture artifacts.

## Recommended Decisions

- Do not ship arbitrary HTML editing.
- Do ship a constrained rich-text/block editor with a polished preview.
- Split `created` into `request_received` and `confirmation` at the customization layer.
- Exclude `pending_attention` and auth emails from phase 1.

---
task: email-template-upgrades
timestamp_utc: 2026-04-02T14:49:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Email Template Upgrades

## Objective

We will upgrade Nabatable's email-template management so restaurant operators can author higher-quality booking emails with explicit subject/preheader control, safer token usage, richer previews, and measurable variant performance.

## Success Criteria

- [ ] Booking email variants persist and render editable `subject` and `preheader`.
- [ ] Invalid or unknown template tokens are surfaced before save/test send.
- [ ] The preview UI shows rendered delivery fields, not just HTML.
- [ ] Delivery metadata includes enough variant detail to support later A/B analysis.
- [ ] Auth magic-link email uses the shared email shell in a visually aligned way.
- [ ] Regression and route tests cover the new contracts.

## Architecture & Components

- `lib/restaurants/email-templates.ts`: extend template variant/domain model, normalization, defaults, and guard helpers.
- `src/app/api/ops/restaurants/schema.ts`: validate new editable fields plus token and duplicate-copy guardrails.
- `server/emails/bookings.ts`: resolve and render subject/preheader, enrich preview payloads, and log variant metadata.
- `server/emails/email-delivery-log.ts`: persist enriched metadata via existing JSON column.
- `src/services/ops/restaurants.ts`: expose expanded preview/template DTOs to the client.
- `src/hooks/ops/useOpsEmailTemplatesPageState.ts`: compute validation hints and preview-facing state.
- `src/components/features/email-templates/*`: upgrade editor and preview UX.
- `server/auth/magic-link-email.ts`: align auth email rendering with shared email design system.

## Data Flow & API Contracts

Endpoint: `PATCH /api/ops/restaurants/:id/email-templates/:templateKey`
Request: `{ variants: [{ id, name, subject, preheader, headline, intro, ctaLabel, isActive, order }] }`
Response: existing template DTO shape, now with richer variant fields.
Errors: validation failures for empty values, unknown tokens, duplicate ids, duplicate active variants, and missing active variants.

Endpoint: `POST /api/ops/restaurants/:id/email-templates/:templateKey/preview`
Request: `{ preferredVariantId?, variants? }`
Response: preview now exposes rendered `subject`, `preheader`, `headline`, `intro`, `ctaLabel`, `ctaUrl`, `selectedVariantId`, `selectedVariantName`, `html`, and `text`.

## UI/UX States

- Editor shows counters, token chips, template guidance, and warnings for suspicious variants.
- Preview shows desktop/mobile HTML plus delivery summary fields.
- Test-send panel keeps current behavior but uses the richer preview contract.

## Edge Cases

- Legacy template documents without `subject` or `preheader`.
- Previewing drafts with unknown tokens.
- Active variants that differ only in internal name.
- Delivery logs for older sends without variant metadata.

## Testing Strategy

- Unit: domain normalization, token extraction/linting, preview rendering.
- Integration: route validation and preview/test-send payloads.
- UI: component tests for preview/editor guardrails where practical.
- Accessibility: verify labels, helper text, and warnings remain readable and keyboard-accessible.

## Rollout

- No feature flag; this is an upgrade to an internal ops surface and its supporting email-rendering path.
- Monitoring: rely on existing email delivery logs plus route/test coverage.
- Kill-switch: template fields remain backwards-compatible through domain normalization, so reverting code restores legacy rendering.

## DB Change Plan (if applicable)

- No schema migration planned.
- Variant analytics will be stored in existing `email_delivery_log.metadata` JSON.

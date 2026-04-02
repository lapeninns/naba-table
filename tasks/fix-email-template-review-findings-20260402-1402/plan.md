---
task: fix-email-template-review-findings
timestamp_utc: 2026-04-02T14:02:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Fix Email Template Review Findings

## Objective

We will harden restaurant email-template sending and persistence so that manual test sends are repeatable, concurrent template edits do not clobber each other, and text/plain bodies use the same CTA destination as HTML emails.

## Success Criteria

- [ ] Re-sending a template test email uses a unique idempotency key per intentional send.
- [ ] Updating one template key preserves other keys already saved in the latest restaurant document.
- [ ] HTML and text versions of booking emails share the same CTA destination for all template types.

## Architecture & Components

- `server/emails/bookings.ts`: fix test-send idempotency and text CTA rendering.
- `server/restaurants/emailTemplates.ts`: merge targeted template updates against the latest persisted document before writing.
- `tests/server/*`: add regression tests around the new server behavior.

## Data Flow & API Contracts

Endpoint: `POST /api/ops/restaurants/:id/email-templates/:templateKey/test-send`
Request: unchanged
Response: unchanged

Endpoint: `PATCH /api/ops/restaurants/:id/email-templates/:templateKey`
Request: unchanged
Response: unchanged

## UI/UX States

- No UI/API shape changes expected.

## Edge Cases

- Multiple admins saving different template keys concurrently.
- Text-only mailbox previews for review, reminder, and cancellation templates.
- Re-sending the same template test email after editing draft copy.

## Testing Strategy

- Unit/integration:
  - Verify `sendRestaurantBookingEmailTest` emits distinct idempotency keys across repeated sends.
  - Verify plain-text output reflects the resolved CTA URL.
  - Verify template upsert merges with the latest fetched document rather than overwriting unrelated keys.

## Rollout

- No flag needed; this is a server-side correctness fix.
- Monitoring: targeted Vitest coverage for regressions.
- Kill-switch: revert the patch if mail/template behavior regresses.

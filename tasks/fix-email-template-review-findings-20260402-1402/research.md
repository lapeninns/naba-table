---
task: fix-email-template-review-findings
timestamp_utc: 2026-04-02T14:02:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Fix Email Template Review Findings

## Requirements

- Functional:
  - Repeated manual test sends for the same template and recipient must deliver again after copy or variant edits.
  - Saving one restaurant email template must not erase unrelated template edits saved concurrently by another admin.
  - The text/plain body must use the same CTA destination as the HTML body for each template type.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Keep the change scoped to the canonical server email/template codepaths.
  - Preserve existing auth and validation behavior on template routes.
  - Avoid introducing wider schema or API changes.

## Existing Patterns & Reuse

- `server/emails/bookings.ts` already centralizes booking email rendering, test sends, and idempotency key generation.
- `server/restaurants/emailTemplates.ts` is the single persistence path for restaurant template overrides.
- `tests/server/restaurant-email-template-routes.test.ts` covers route contracts but not lower-level booking email behavior.

## External Resources

- No external docs needed; review findings were based on local code behavior.

## Constraints & Risks

- The restaurant `email_templates` field is stored as a full JSON document, so partial updates must avoid stale read/overwrite behavior.
- Fixing manual test sends should not weaken production booking-email idempotency.
- CTA parity must preserve existing template-specific destination rules.

## Open Questions (owner, due)

- Q: Should template persistence move to optimistic concurrency with version stamps later?
  A: Out of scope for this fix; a server-side merge on latest state is sufficient now. (owner: github:@amanshresthaa, due: 2026-04-02)

## Recommended Direction (with rationale)

- Generate manual test-send idempotency keys from a fresh nonce so each intentional send is unique while production sends remain deterministic.
- Refetch the latest email-template document immediately before persisting and merge only the targeted template key into that latest snapshot.
- Thread the resolved CTA URL through the plain-text renderer so HTML/text outputs stay aligned.

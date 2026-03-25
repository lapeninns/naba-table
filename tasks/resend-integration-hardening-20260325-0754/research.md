---
task: resend-integration-hardening
timestamp_utc: 2026-03-25T07:54:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Resend Integration Hardening

## Requirements

- Functional:
  - Ensure the canonical Resend send path uses the verified `notifications.nabatable.com` sender default.
  - Replace the placeholder Resend webhook auth with official signature verification.
  - Support first-class Resend send options already available in the installed SDK.
  - Prevent sends to recipients already marked as suppressed in `user_profiles`.
  - Add enough structured metadata to correlate email flows inside Resend.
- Non-functional:
  - Keep the change focused on the primary email codepath.
  - Preserve transactional-email behavior; do not introduce marketing unsubscribe semantics without a real unsubscribe flow.
  - Use official Resend SDK/docs as the source of truth.

## Existing Patterns & Reuse

- Canonical send helper: `libs/resend.ts`
- Canonical Resend webhook route: `src/app/api/webhook/resend/route.ts`
- Current sending callers:
  - `server/emails/bookings.ts`
  - `server/emails/invitations.ts`
  - `server/auth/magic-link-email.ts`
- Existing suppression source of truth: `user_profiles.is_email_suppressed`
- Existing delivery observability/logging:
  - `server/emails/email-delivery-log.ts`
  - `server/observability.ts`

## External Resources

- Context7 `/websites/resend`:
  - Webhook verification uses `resend.webhooks.verify(...)` with raw payload plus `svix-id`, `svix-timestamp`, and `svix-signature`.
  - Email send supports request-level idempotency keys.
  - Email payload supports `headers`, `tags`, and `topicId`.
  - Complaint/bounce style events are emitted via webhooks for suppression handling.
- Local SDK source `node_modules/resend/dist/index.d.mts` confirms:
  - `CreateEmailRequestOptions.idempotencyKey`
  - `CreateEmailOptions.headers`
  - `CreateEmailOptions.tags`
  - `CreateEmailOptions.topicId`
  - `webhooks.verify(...)`

## Constraints & Risks

- No UI changes are in scope, so Chrome DevTools QA is not required for this task.
- Suppression checks sit on the send hot path; failure semantics must be explicit and safe.
- `List-Unsubscribe` is intentionally deferred because current emails are operational/auth oriented and the product does not yet expose a dedicated unsubscribe flow for these messages.
- Invite/auth/booking idempotency keys must avoid suppressing legitimate future sends while still deduplicating retries.

## Open Questions (owner, due)

- Q: Should transactional booking/recovery emails eventually use Resend Topics for category-level preferences?
  A: Deferred. No topic configuration exists yet, but helper support should be added now. (owner: github:@maintainers, due: next email iteration)

## Recommended Direction (with rationale)

- Harden the existing `libs/resend.ts` path instead of introducing a new wrapper.
- Use official Resend webhook verification in `src/app/api/webhook/resend/route.ts`.
- Add native Resend send options to the shared helper and thread tags/idempotency through current callers.
- Enforce recipient suppression at the canonical send boundary so future senders inherit the protection automatically.

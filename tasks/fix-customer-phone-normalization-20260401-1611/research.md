---
task: fix-customer-phone-normalization
timestamp_utc: 2026-04-01T16:11:00Z
owner: github:@openai
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Fix customer phone normalization duplicate collisions

## Requirements

- Functional:
- Allow ops booking creation with phone-only contact when the same UK phone is supplied in equivalent formats such as `+44...`, `0...`, or `44...`.
- Reuse the existing customer record instead of attempting a duplicate insert.
- Keep non-UK or non-parseable phone formats working through a safe fallback normalization path.
- Non-functional (a11y, perf, security, privacy, i18n):
- Keep the fix on the canonical customer matching path.
- Avoid leaking raw database uniqueness errors for this known matching scenario.

## Existing Patterns & Reuse

- Canonical ops booking creation uses `src/app/api/ops/bookings/route.ts`.
- Canonical public booking creation uses `src/app/api/bookings/route.ts`.
- Customer matching and insert logic lives in `server/customers.ts`.
- Shared UK phone canonicalization already exists in `reserve/shared/validation/contact.ts` via `formatUKPhoneToE164`.
- Reserve timeout recovery has its own client-side booking matcher in `reserve/features/reservations/wizard/utils/timeoutRecovery.ts`.
- Guest self-serve booking edit/cancel/session-recovery logic lives in `src/app/api/bookings/[id]/route.ts`.

## External Resources

- N/A. Codebase-local investigation only.

## Constraints & Risks

- Root cause: `upsertCustomer` lookup currently uses `normalizePhone`, which strips to digits only, while insert canonicalizes UK numbers to E.164 before persistence.
- Example: lookup searches for `07950272147`, but insert stores `+447950272147`, and the unique index is enforced on the canonical `phone_normalized` value `447950272147`.
- `normalizePhone` is used in guest lookup and booking/token comparisons, so the normalization change should preserve or improve cross-surface matching behavior.
- Additional audit findings:
  - Reserve timeout recovery used a separate digits-only normalizer, so a timed-out booking could be created successfully but fail client-side recovery when the draft used `07...` and the API returned `+44...`.
  - Guest self-serve `PUT /api/bookings/[id]` compared raw `customer_phone` strings for ownership, so the same user could be rejected if they switched input format.
- Residual risk not changed in this pass:
  - `server/bookings.ts::addToWaitingList` still stores/looks up `waiting_list.customer_phone` by exact formatted string rather than a shared normalized key.

## Open Questions (owner, due)

- Q: Should non-UK numbers be canonicalized too?
  A: For this fix, no. Keep non-UK values on a digits-only fallback so we solve the production bug without broadening phone policy.

## Recommended Direction (with rationale)

- Make `normalizePhone` canonicalize valid UK numbers to E.164 digits-without-plus before both lookup and insert decisions.
- Keep a digits-only fallback for values that are not recognized as valid UK numbers.
- Reuse the same comparable-phone helper in reserve timeout recovery so booking recovery behavior matches the server.
- Update guest self-serve ownership comparison to use normalized phone equality instead of raw string equality.
- Add focused tests for equivalent UK formats and timeout recovery matching.

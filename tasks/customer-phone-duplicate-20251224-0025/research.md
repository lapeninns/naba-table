---
task: customer-phone-duplicate
timestamp_utc: 2025-12-24T00:24:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Handle phone-unique customer conflicts

## Requirements

- Functional: Avoid failing booking creation when a customer already exists for the restaurant with the same normalized phone; reuse/update the existing record instead of surfacing a 23505.
- Non-functional: Preserve existing email/phone normalization behavior; keep marketing opt-in semantics intact.

## Existing Patterns & Reuse

- Customer upsert lives in `server/customers.ts`, uses Supabase upsert with conflict targets and fallback keys.
- Current unique-violation recovery only looks up by email, not phone, leading to 23505 on `customers_restaurant_id_phone_normalized_key` when email differs.
- Tests exist in `server/__tests__/customers.test.ts` covering email-conflict reuse.

## Constraints & Risks

- Must not overwrite existing email if conflict is phone-only unless explicitly intended by current logic.
- Must preserve marketing opt-in sticky behavior and phone update semantics.
- Avoid double queries causing excessive latency; prefer targeted lookups.

## Open Questions

- Should we update the stored phone when the incoming normalized phone differs? (current behavior already updates phone when different)
- Do we ever want to merge emails when phone matches but email differs? (assume we keep existing email and just return the existing record)

## Recommended Direction

- On unique violation (23505), look up existing customer by email; if not found, look up by phone_normalized; return existing and optionally update phone if the stored normalized value differs.
- Add a unit test covering phone-based conflicts.

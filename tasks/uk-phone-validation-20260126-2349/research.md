---
task: uk-phone-validation
timestamp_utc: 2026-01-26T23:49:11Z
owner: github:@copilot
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Expand UK Phone Validation Coverage

## Requirements

- Functional:
- Accept more valid UK phone number types (not just 07 mobile numbers).
- Preserve DB constraint compatibility: `customers_phone_check` (length 7–20).
- Keep a single canonical phone-validation rule used across ops and customer flows.
- Non-functional (a11y, perf, security, privacy, i18n):
- Validate at system boundaries; fail fast with clear messages.

## Existing Patterns & Reuse

- Canonical phone validation currently lives in `reserve/shared/validation/contact.ts::isUKPhone`.
- Current regex only accepts UK mobile numbers: `^(?:\+44|44|0)7\d{9}$`.
- Phone validation is used in:
- `src/app/api/ops/bookings/schema.ts`
- `reserve/features/reservations/wizard/model/schemas.ts`
- Length constraints are centralized as `CUSTOMER_PHONE_LENGTH_MIN/MAX` in `reserve/shared/validation/contact.ts`.

## External Resources

- Use a production-grade phone parsing library rather than expanding regexes manually.

## Constraints & Risks

- Supply chain risk from new dependency; use a well-known library.
- Avoid database changes unless explicitly requested.
- Any canonicalization must remain within the DB length constraint and not break matching by `phone_normalized`.
- Dependency added: `libphonenumber-js@1.12.35` (well-known, but still a supply-chain consideration).

## Recommended Direction (with rationale)

- Replace regex-only validation with `libphonenumber-js` for GB parsing/validation.
- Canonicalize valid GB numbers to E.164 for storage compatibility and consistency.
- Keep `isUKPhone` as the single canonical validator, but make it broader and more accurate.

---
task: uk-phone-coverage
timestamp_utc: 2026-04-01T16:36:00Z
owner: github:@openai
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Broaden UK phone coverage across booking flows

## Requirements

- Functional:
- Accept a wider range of valid UK numbering-plan phone numbers across guest and ops booking flows.
- Ensure shared validation accepts standard GB numbers and Crown dependency numbers on the `+44` numbering plan that users commonly enter as UK numbers.
- Apply the same phone validation rule across reserve UI, ops API, public booking create/list, and guest self-serve update routes.
- Non-functional (a11y, perf, security, privacy, i18n):
- Keep validation centralized instead of duplicating route-specific phone rules.
- Reject obviously invalid phone inputs at API boundaries instead of relying on deeper persistence behavior.

## Existing Patterns & Reuse

- Shared phone validation lives in `reserve/shared/validation/contact.ts`.
- Reserve wizard and ops booking schema already depend on `isUKPhone`.
- Public booking create/list and guest self-serve update routes currently validate phone mostly by length, not by shared UK-phone semantics.

## External Resources

- Codebase-local probe using installed `libphonenumber-js@1.12.35`.

## Constraints & Risks

- Current helper rejects valid Crown dependency numbers because it requires `phone.country === 'GB'`.
- `libphonenumber-js` recognizes valid `+44` numbers for:
  - `GB`
  - `IM`
  - `GG`
  - `JE`
- Some representative ranges already parse as valid:
  - geographic: `020 7123 4567`
  - mobile: `07123 456789`
  - freephone: `0800 123 4567`
  - non-geographic/UAN: `0300 123 4567`, `0333 123 4567`, `055 1234 5678`
  - VoIP: `056 1234 5678`
  - personal numbers: `070 1234 5678`
  - Crown dependencies: `07624 123456` (IM), `07781 123456` (GG), `07797 123456` (JE)

## Open Questions (owner, due)

- Q: Should all `+44` numbering-plan countries be treated as “UK” for product validation?
  A: For this pass, yes: accept `GB`, `IM`, `GG`, and `JE` because users commonly enter them as UK numbers and the installed phone library validates them.

## Recommended Direction (with rationale)

- Widen the shared helper to accept the supported UK numbering-plan countries recognized by the installed phone library.
- Reuse that shared helper at public API boundaries that currently only enforce length.
- Add focused tests covering a broad range of accepted UK phone types plus rejection of known-invalid samples.

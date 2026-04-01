---
task: fix-customer-phone-normalization
timestamp_utc: 2026-04-01T16:11:00Z
owner: github:@openai
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Verification Report

## Automated Proof

- `npx vitest run tests/server/customers.test.ts tests/reserve/timeoutRecovery.test.ts`
  - Result: pass
  - Coverage proved:
    - `normalizePhone` maps `07950 272147`, `447950272147`, and `+447950272147` to the same canonical value `447950272147`
    - `upsertCustomer` lookup reuses an existing customer when the request supplies the same UK number in `07...` format
    - reserve timeout recovery matches a returned booking with `+44...` against a draft entered as `07...`
- `pnpm typecheck`
  - Result: pass

## Manual QA — Chrome DevTools (MCP)

- Not required for this change because there is no UI behavior change.

## Artifacts

- No separate artifact files generated. Verification was completed through focused automated proof on the canonical backend path.

## Known Issues

- Residual risk: `waiting_list.customer_phone` still uses exact string storage/lookup in `server/bookings.ts::addToWaitingList`, so equivalent UK phone formats are not yet unified there.

## Sign-off

- [x] Engineering

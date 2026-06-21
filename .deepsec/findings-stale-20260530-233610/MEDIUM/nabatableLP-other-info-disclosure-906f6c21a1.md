# [MEDIUM] Customer contact PII is written to server logs

**File:** [`server/customers.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/server/customers.ts#L168-L245) (lines 168, 170, 171, 206, 216, 219, 245)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-info-disclosure`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

upsertCustomer logs normalized customer email and phone for every customer resolution, logs update payloads that can include full_name and phone, and logs raw Supabase insert/update errors that may include duplicate-key details with normalized contact values. This helper is reachable from public booking creation with guest-supplied contact data and from ops booking flows, so customer PII can be copied into production log/observability systems outside the intended tenant-scoped data access path.

## Recommendation

Remove email, phone, full_name, and raw database error details from logs. Log stable IDs, restaurantId, error codes, and redacted or keyed-hash contact fingerprints only when needed for debugging.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-19)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-27)

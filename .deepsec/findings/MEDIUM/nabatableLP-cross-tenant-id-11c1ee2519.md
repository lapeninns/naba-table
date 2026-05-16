# [MEDIUM] Delivery retry helper branches on unscoped delivery log IDs before tenant authorization

**File:** [`server/emails/email-delivery-log.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/emails/email-delivery-log.ts#L670-L709) (lines 670, 678, 695, 701, 705, 709)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `cross-tenant-id`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

getEmailDeliveryLogEntryById loads any email_delivery_log row by id using the service-role client, and retryEmailDeliveryLogEntry returns NOT_FOUND, NOT_RETRYABLE, or MISSING_BOOKING before the caller's resendBookingEmail callback has a chance to verify restaurant membership. The current retry API passes a request-supplied deliveryLogId into this helper, so a logged-in user with a known or leaked delivery log UUID from another tenant can distinguish whether that row exists and whether it is failed/bounced or tied to a booking.

## Recommendation

Require an authorized restaurant scope before loading the delivery log entry. Accept restaurantId in the retry request or derive it from the selected tenant, verify membership first, and query the log with both id and restaurant_id. Return a generic 404/403 for missing or unauthorized rows before exposing retryability state.

## Revalidation

**Verdict:** fixed

`retryEmailDeliveryLogEntry` now accepts authorized restaurant ids and `getEmailDeliveryLogEntryById` scopes the service-role lookup with `restaurant_id in (...)`. The retry route derives that scope from the authenticated user's memberships before calling the helper. Covered by `tests/server/email-delivery-retry-route.test.ts` and `tests/server/email-delivery-log-retry-scope.test.ts`.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-20)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-12)

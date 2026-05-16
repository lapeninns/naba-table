# [MEDIUM] SMS dashboard fetch exposes provider metadata that the UI does not need

**File:** [`src/components/features/sms-delivery/OpsSmsDeliveryClient.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/components/features/sms-delivery/OpsSmsDeliveryClient.tsx#L163-L488) (lines 163, 488)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-info-disclosure`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The client fetches the full restaurant SMS delivery feed via bookingService.getRestaurantSmsDeliveryFeed and then only renders event status badges. Tracing that service to /api/ops/sms-delivery shows the API returns listResult.attempts verbatim; server/sms/delivery-log.ts selects error and metadata from sms_delivery_log and toEntryDto includes both fields in every event. Twilio webhook records metadata.accountSid, metadata.from, provider status/error code, and error messages. Any authenticated restaurant member who can access this dashboard/API can inspect the JSON response and recover internal Twilio account identifiers/provider diagnostics even though the UI does not display or require them. The endpoint does enforce restaurant membership, so this is not cross-tenant, but it is unnecessary disclosure of platform/provider internals to low-privilege ops users.

## Recommendation

Return a sanitized feed DTO for this dashboard. Strip events[].metadata and events[].error, or gate those fields behind an explicit admin-only diagnostic view. Prefer mapping the API response server-side before NextResponse.json rather than relying on the React component not to render sensitive fields.

## Revalidation

**Verdict:** fixed

`src/app/api/ops/sms-delivery/route.ts` maps feed rows through `sanitizeOpsSmsDeliveryAttempts`, which strips provider metadata and raw errors before `NextResponse.json`. Covered by `tests/server/sms-delivery-route.test.ts`.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-04)

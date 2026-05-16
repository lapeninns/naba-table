# [HIGH] Legacy booking update path allows unauthenticated reservation mutation

**File:** [`src/app/api/bookings/[id]/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/bookings/[id]/route.ts#L1169-L1395) (lines 1169, 1180, 1211, 1216, 1228, 1238, 1320, 1341, 1395)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `missing-auth`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The full-update fallback in PUT does not require a session or signed session-recovery token. It calls auth.getUser(), but only logs authError and never checks that a user exists. The only gate is matching the submitted email and phone against the existing booking, after which the service-role client updates the booking. The same path also accepts data.restaurantId and writes it into the update payload, so a caller who knows a booking UUID plus contact details can change reservation details and potentially move the booking to another active restaurant tenant.

## Recommendation

Remove the unauthenticated legacy update path, or require a valid session-recovery access token/session before any mutation. Do not accept restaurantId changes from guest self-service updates; require it to match existingBooking.restaurant_id. Return a sanitized DTO instead of the full updated row.

## Revalidation

**Verdict:** fixed

The current full-update fallback no longer just logs auth failures and continues. After parsing the legacy update schema, it validates a supplied session-recovery token or calls tenantSupabase.auth.getUser(), and it returns 401 when neither a valid recovery token nor a Supabase user is present. After loading the booking with the service client, the recovery-token path must match restaurant, email, and phone, while the authenticated path must satisfy isBookingOwnedByUser by auth_user_id or normalized email. The route also rejects any submitted restaurantId that differs from existingBooking.restaurant_id before building the update payload. The actual update uses the existing restaurant context, and updateBookingRecord is called with the restaurantId guard. Git blame shows the auth gate and restaurant-lock checks were added in commit 020a7389. An attacker who only knows a booking UUID and contact details can no longer reach this mutation unauthenticated or move the booking to another tenant through data.restaurantId.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)

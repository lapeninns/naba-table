# Session Recovery Log: 2025-12-24

## Summary

This document captures all database-related issues and fixes implemented during the December 24, 2025 session, focusing on the **Guest Booking Access System** revamp.

---

## Issue 1: Token-Based Booking Lookup Failures

### Problem

The previous booking access system used `confirmation_token` as a **lookup key** in the database:

```sql
SELECT * FROM bookings WHERE confirmation_token = 'xyz123'
```

This caused **404 errors** for:

- Bookings created before the token feature existed (null `confirmation_token`)
- Bookings where the token column was not populated
- Cases where the token was regenerated but email links had old tokens

### Solution

Implemented **ID-first lookup** strategy:

```sql
-- Step 1: Always find booking by ID first
SELECT * FROM bookings WHERE id = '{booking_id}'

-- Step 2: Then validate access (token, auth, or ownership)
```

### Files Changed

- `src/app/api/bookings/[id]/route.ts` - Refactored GET handler

---

## Issue 2: Legacy Token Mismatch Warnings

### Problem

Log showing repeated warnings:

```
[bookings][GET:id][token:fallback] token mismatch {
  bookingId: '1c6224b7-2b3e-4478-b583-aa9a16945491',
  storedTokenPrefix: 'M9caCF7c...',
  providedTokenPrefix: 'oFXpk6Uz...'
}
```

This occurred when:

1. User clicked an email link with token A
2. Booking had a different token B stored in `confirmation_token` column
3. System rejected access because tokens didn't match

### Root Cause

Old emails contained random tokens that were stored in the database. If a new email was sent (with a new token), the stored token was updated, but old email links still had the original token.

### Solution

Implemented **HMAC-based stateless tokens** that don't require database storage:

- Token format: `v2.{bookingId}.{expiryTimestamp}.{hmacSignature}`
- Self-validating via cryptographic signature
- No database lookup required for new tokens

Added **legacy token fallback** for backward compatibility:

```typescript
export function validateToken(
  token: string,
  expectedBookingId: string,
  options?: { booking?: Tables<'bookings'> | null },
): AccessTokenValidationResult {
  // Try HMAC first
  if (isValidTokenFormat(token)) {
    return validateAccessToken(token, expectedBookingId);
  }

  // Legacy fallback: compare against stored confirmation_token
  const booking = options?.booking;
  if (booking?.confirmation_token === token) {
    // Check expiry and grant access
  }
}
```

### Files Changed

- `server/bookings/access-token.ts` - New token service
- `src/app/api/bookings/[id]/route.ts` - Pass booking to validateToken

---

## Issue 3: Bookings with Null confirmation_token

### Problem

Legacy bookings created before the token feature had:

```sql
confirmation_token = NULL
confirmation_token_expires_at = NULL
```

These bookings couldn't be accessed via email links because there was no token to validate.

### Solution

When `confirmation_token` is null and a token is provided:

1. System grants access (booking exists, user has some token)
2. Logs the event for monitoring

```typescript
if (!storedToken) {
  console.info('[access-token] Legacy fallback: booking has no stored token, granting access');
  return { valid: true, bookingId: expectedBookingId };
}
```

---

## Issue 4: Token Expiry Checks

### Problem

Some bookings had expired `confirmation_token_expires_at` values, but the system wasn't consistently checking them.

### Solution

Explicit expiry validation in legacy fallback:

```typescript
if (booking.confirmation_token_expires_at) {
  const expiryDate = new Date(booking.confirmation_token_expires_at);
  if (expiryDate < new Date()) {
    return { valid: false, error: 'EXPIRED' };
  }
}
```

---

## Issue 5: Database Dependency for Token Validation

### Problem

Every token validation required a database query:

```sql
SELECT id, confirmation_token, confirmation_token_expires_at
FROM bookings
WHERE confirmation_token = '{token}'
```

This added latency and database load for every booking access.

### Solution

New HMAC tokens are **stateless** - no database operation needed:

1. Token contains embedded booking ID and expiry
2. Signature verified cryptographically using `BOOKING_ACCESS_TOKEN_SECRET`
3. Only database query is the ID-based booking lookup (required anyway)

---

## Database Schema Notes

### Columns Used

| Column                          | Type        | Purpose                          |
| ------------------------------- | ----------- | -------------------------------- |
| `id`                            | UUID        | Primary lookup key (always used) |
| `confirmation_token`            | TEXT        | Legacy random token storage      |
| `confirmation_token_expires_at` | TIMESTAMPTZ | Legacy token expiry              |
| `customer_email`                | TEXT        | Owner verification               |

### No Schema Changes Required

The HMAC token system doesn't require any database migrations. The existing `confirmation_token` columns remain for:

- Legacy email link compatibility
- Gradual migration period

---

## Environment Variables Added

| Variable                            | Required   | Default       | Description                     |
| ----------------------------------- | ---------- | ------------- | ------------------------------- |
| `BOOKING_ACCESS_TOKEN_SECRET`       | Yes (prod) | Dev fallback  | HMAC signing key (min 32 chars) |
| `BOOKING_ACCESS_TOKEN_EXPIRY_HOURS` | No         | 720 (30 days) | Token validity period           |

---

## Test Coverage Added

| Test File                                          | Tests | Description                 |
| -------------------------------------------------- | ----- | --------------------------- |
| `tests/server/bookings/access-token.test.ts`       | 27    | Token generation/validation |
| `tests/server/bookings/booking-api-access.test.ts` | 22    | API access scenarios        |

---

## Related Files

### New Files

- `server/bookings/access-token.ts` - HMAC token service
- `tests/server/bookings/access-token.test.ts`
- `tests/server/bookings/booking-api-access.test.ts`
- `tasks/guest-booking-access-revamp-20251224-0124/` - Task documentation

### Modified Files

- `src/app/api/bookings/[id]/route.ts`
- `server/emails/bookings.ts`
- `reserve/features/reservations/wizard/api/useReservation.ts`
- `src/components/features/booking/detail/ReservationDetailClient.tsx`
- `config/env.schema.ts`
- `lib/env.ts`
- `docs/prod.env`

---

## User-Facing Changes

### Before

- "Booking not found" errors for old email links
- Inconsistent access based on token state
- Silent failures with no guidance

### After

- Clear "Link Expired" UI with sign-in prompt
- "Access Denied" state with helpful messaging
- Token-based access indicator ("Viewing via email link")
- ReservationHistory only shown for authenticated owners (not token access)

---

## Monitoring Recommendations

Watch for these log patterns:

```
[access-token] Legacy fallback: booking has no stored token, granting access
[access-token] Legacy token validated successfully
[access-token] Legacy token mismatch
```

High volume of mismatches may indicate:

- Old emails still in circulation
- Token regeneration issues
- Potential security concern if unexpected

---

## Future Considerations

1. **Token Migration**: Consider sending new confirmation emails with HMAC tokens to replace legacy links
2. **Database Cleanup**: After migration period, can remove `confirmation_token` column usage
3. **Token Refresh**: Add UI for users to request new email link if theirs expired

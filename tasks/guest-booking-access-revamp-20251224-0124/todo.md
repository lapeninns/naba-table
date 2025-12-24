---
task: guest-booking-access-revamp
timestamp_utc: 2025-12-24T01:24:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Add `BOOKING_ACCESS_TOKEN_SECRET` to env schema (`config/env.schema.ts`)
- [x] Add `BOOKING_ACCESS_TOKEN_EXPIRY_HOURS` to env schema
- [x] Add `bookingAccess` accessor to `lib/env.ts`
- [x] Add to `docs/prod.env` for documentation

## Core - Access Token Service

- [x] Create `server/bookings/access-token.ts` with:
  - [x] `generateAccessToken(bookingId, options?)` - HMAC token generation
  - [x] `validateAccessToken(token, bookingId)` - HMAC validation
  - [x] `isLegacyToken(token)` - Detect old vs new format
  - [x] `validateLegacyToken(token, bookingId, supabase)` - DB fallback
  - [x] `validateToken(token, bookingId)` - Unified validation (HMAC first, then legacy)
  - [x] `determineAccessLevel()` - Access level determination
  - [x] `mapTokenErrorToStatus()` - HTTP status mapping
  - [x] `mapTokenErrorToMessage()` - User-friendly error messages

## Core - API Handler Refactor

- [x] Refactor `app/api/bookings/[id]/route.ts` GET handler:
  - [x] Extract booking lookup as first step (ID-based)
  - [x] Implement access level determination (owner/staff/token)
  - [x] Use new token service for validation
  - [x] Return access level in response (`access: { level, canModify, canCancel }`)
  - [x] Clean up fallback/patch code (legacy code removed)

## Core - Email Token Generation

- [x] Update `server/emails/bookings.ts`:
  - [x] Update `buildManageUrl()` to use `generateAccessToken()`
  - [x] Keep fallback to legacy `confirmation_token` during migration

## UI/UX

- [x] Update `useReservation` hook to return access info:
  - [x] Export `AccessInfo` and `ReservationWithAccess` types
  - [x] Return `{ reservation, access }` from hook
  - [x] Backward compatible with existing consumers
- [x] Update `ReservationDetailClient` to handle access levels:
  - [x] Use access info from API response
  - [x] Derive `canManage` from access info
  - [x] Show appropriate actions based on `access.canModify`, `access.canCancel`
- [x] Add token error UI states:
  - [x] Link expired state with "Sign in to view booking" CTA
  - [x] Access denied state with appropriate messaging
  - [x] Token access indicator ("Viewing via email link")

## Tests

- [x] Create `tests/server/bookings/access-token.test.ts` (24 tests):
  - [x] Token generation tests (format, expiry, URL-safe, signatures)
  - [x] Token validation tests (valid, expired, tampered, wrong booking)
  - [x] Legacy token detection tests
  - [x] Error mapping tests
- [x] Create `tests/server/bookings/booking-api-access.test.ts` (23 tests):
  - [x] ID-first lookup tests
  - [x] Access level tests (owner, token)
  - [x] Response shape tests
  - [x] Error response tests
  - [x] Legacy token fallback tests
  - [x] Access permissions by status tests

## Documentation

- [x] Document environment variables in `docs/prod.env`
- [x] Add inline code documentation

---

## Summary of Changes

### New Files

| File                                               | Description                                                      |
| -------------------------------------------------- | ---------------------------------------------------------------- |
| `server/bookings/access-token.ts`                  | Core HMAC token service (generation, validation, access control) |
| `tests/server/bookings/access-token.test.ts`       | Unit tests for token service (24 tests)                          |
| `tests/server/bookings/booking-api-access.test.ts` | Integration tests for API access (23 tests)                      |

### Modified Files

| File                                                                 | Change                                                        |
| -------------------------------------------------------------------- | ------------------------------------------------------------- |
| `config/env.schema.ts`                                               | Added `BOOKING_ACCESS_TOKEN_SECRET` and expiry config         |
| `lib/env.ts`                                                         | Added `bookingAccess` accessor                                |
| `src/app/api/bookings/[id]/route.ts`                                 | Refactored GET handler with ID-first lookup and access levels |
| `server/emails/bookings.ts`                                          | Updated `buildManageUrl()` to use HMAC tokens                 |
| `reserve/features/reservations/wizard/api/useReservation.ts`         | Returns `{ reservation, access }`                             |
| `src/components/features/booking/detail/ReservationDetailClient.tsx` | Uses access from API, added error states                      |
| `docs/prod.env`                                                      | Documented new environment variables                          |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│          EMAIL LINK: /bookings/{id}?token={token}           │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│ 1️⃣  LOOKUP BY ID (Always first)                             │
│     SELECT * FROM bookings WHERE id = {id}                  │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│ 2️⃣  DETERMINE ACCESS                                        │
│     ┌───────────────────────────────────────────────────┐   │
│     │ Authenticated user?                               │   │
│     │   → Email matches? → OWNER (full control)         │   │
│     │   → Staff member? → STAFF (full control)          │   │
│     ├───────────────────────────────────────────────────┤   │
│     │ Token provided?                                   │   │
│     │   → v2. prefix? → HMAC validation (stateless)     │   │
│     │   → Legacy? → DB lookup fallback                  │   │
│     │   → Valid? → TOKEN (read + limited)               │   │
│     ├───────────────────────────────────────────────────┤   │
│     │ Neither?                                          │   │
│     │   → 401 UNAUTHENTICATED                           │   │
│     └───────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│ 3️⃣  RESPONSE WITH ACCESS INFO                               │
│     {                                                       │
│       booking: { ... },                                     │
│       access: { level, canModify, canCancel }               │
│     }                                                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Token Format

### New HMAC Token (v2)

```
v2.{bookingId}.{expiryTimestamp}.{hmacSignature}

Example:
v2.123e4567-e89b-12d3-a456-426614174000.1737388800.Zy9vT4mXx8qR7wVnK3pL1sJf
```

### Legacy Token (random)

```
{random-base64url-string}

Example:
x7Kp2mNwQr5sVt8yBz3jLf9a
```

---

## Test Results

```
 ✓ tests/server/bookings/access-token.test.ts        (24 tests)
 ✓ tests/server/bookings/booking-api-access.test.ts  (23 tests)
 ─────────────────────────────────────────────────────────────
 Total: 47 tests passed ✅
```

---

## Notes

- **ID-first lookup**: Booking is found by ID before any token validation
- **Stateless HMAC tokens**: No database storage needed for new tokens
- **Backward compatible**: Legacy tokens work via DB fallback during migration
- **Access levels**: Owner > Staff > Token > None
- **30-day expiry**: Default token validity period

---
task: guest-booking-access-revamp
timestamp_utc: 2025-12-24T01:24:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Guest Booking Access System Revamp

## Objective

Revamp the guest booking access system with a clean, logical architecture where:

- Booking ID is the primary lookup key
- Tokens are HMAC-based authentication credentials (stateless)
- Clear separation between lookup and authentication
- Backward compatible with existing email links

## Success Criteria

- [ ] New HMAC token generation and validation works for all new bookings
- [ ] Existing email links (with old random tokens) continue to work
- [ ] API returns appropriate status codes (401, 403, 404, 410)
- [ ] No regression in booking access flows
- [ ] Performance: Token validation < 1ms (no DB call for new tokens)
- [ ] All tests passing

## Architecture & Components

### New Token Service: `server/bookings/access-token.ts`

```
┌─────────────────────────────────────────────────────────────────┐
│                     AccessTokenService                          │
├─────────────────────────────────────────────────────────────────┤
│ generate(bookingId, options?): string                           │
│   → Creates HMAC-signed token with embedded expiry              │
│                                                                 │
│ validate(token, bookingId): ValidationResult                    │
│   → Validates signature, expiry, booking ID match               │
│                                                                 │
│ validateLegacy(token, bookingId, supabase): ValidationResult    │
│   → Falls back to DB lookup for old random tokens               │
│                                                                 │
│ refresh(bookingId): string                                      │
│   → Generates new token (for resend email flows)                │
└─────────────────────────────────────────────────────────────────┘
```

### Updated API Handler: `app/api/bookings/[id]/route.ts`

```
┌─────────────────────────────────────────────────────────────────┐
│                    GET /api/bookings/{id}                       │
├─────────────────────────────────────────────────────────────────┤
│ 1. Parse booking ID from URL params                             │
│ 2. Lookup booking by ID (single source of truth)                │
│ 3. If not found → 404 BOOKING_NOT_FOUND                         │
│ 4. Check access mode:                                           │
│    ┌─────────────────────────────────────────────────────────┐  │
│    │ Mode A: Authenticated User                              │  │
│    │   - Check if user email matches booking.customer_email  │  │
│    │   - Check if user is restaurant staff                   │  │
│    │   - If either → grant access with canManage=true        │  │
│    ├─────────────────────────────────────────────────────────┤  │
│    │ Mode B: Token-Based Access                              │  │
│    │   - Validate token (HMAC first, legacy fallback)        │  │
│    │   - If valid → grant read-only access                   │  │
│    ├─────────────────────────────────────────────────────────┤  │
│    │ Mode C: No Access                                       │  │
│    │   - No auth, no token → 401 UNAUTHENTICATED             │  │
│    └─────────────────────────────────────────────────────────┘  │
│ 5. Return booking with access level                             │
└─────────────────────────────────────────────────────────────────┘
```

### Token Format

```
New HMAC Token (v2):
┌─────────────────────────────────────────────────────────────────┐
│  v2.{bookingId}.{expiryTimestamp}.{hmacSignature}               │
│  └───┬────────────────────────────────────────────────────────┘ │
│      └─ Base64URL encoded for URL safety                        │
└─────────────────────────────────────────────────────────────────┘

Legacy Random Token (v1):
┌─────────────────────────────────────────────────────────────────┐
│  {random43CharacterBase64UrlEncodedString}                      │
│  └─ No prefix, detected by absence of version marker           │
└─────────────────────────────────────────────────────────────────┘

Detection Logic:
  token.startsWith('v2.') ? validateHMAC() : validateLegacy()
```

## Data Flow & API Contracts

### Request Flow

```
Guest clicks email link:
  GET /bookings/{id}?token={token}
       │
       ▼
  ┌────────────────────────┐
  │ Page Server Component  │
  │ (public)/bookings/[id] │
  └───────────┬────────────┘
              │ fetch with token
              ▼
  ┌────────────────────────┐
  │ GET /api/bookings/{id} │
  │ ?token={token}         │
  └───────────┬────────────┘
              │
              ▼
  ┌────────────────────────┐     ┌──────────────────┐
  │ 1. Lookup by ID        │────▶│ Supabase         │
  │ 2. Validate token      │     │ bookings table   │
  │ 3. Build response      │     └──────────────────┘
  └───────────┬────────────┘
              │
              ▼
  ┌────────────────────────┐
  │ Response:              │
  │ { booking, access }    │
  └────────────────────────┘
```

### Response Contract

```typescript
// Success (200)
{
  booking: {
    id: string;
    reference: string;
    status: "pending" | "confirmed" | "cancelled" | ...;
    booking_date: string;
    start_time: string;
    end_time: string;
    party_size: number;
    customer_name: string;
    // ... other fields
    restaurants: {
      name: string;
      slug: string;
      timezone: string;
    };
  };
  access: {
    level: "owner" | "staff" | "token";
    canModify: boolean;
    canCancel: boolean;
  };
}

// Error Responses
{ error: string; code: string; }
  - 400: MISSING_BOOKING_ID
  - 401: UNAUTHENTICATED (no token, no session)
  - 403: TOKEN_MISMATCH (token for different booking)
  - 404: BOOKING_NOT_FOUND
  - 410: TOKEN_EXPIRED
```

## UI/UX States

### Booking Detail Page States

| State           | Trigger                | Display                              |
| --------------- | ---------------------- | ------------------------------------ |
| Loading         | Initial fetch          | Skeleton/spinner                     |
| Success (Owner) | Auth user owns booking | Full details + modify/cancel buttons |
| Success (Token) | Valid token            | Full details + limited actions       |
| Not Found       | 404                    | "Booking not found" message          |
| Token Expired   | 410                    | "Link expired" + sign in prompt      |
| Unauthorized    | 401                    | Sign in prompt                       |

## Edge Cases

1. **Token for wrong booking**: User has token for booking A, visits /bookings/B → 403
2. **Expired token**: Created > 30 days ago → 410 with renewal option
3. **Cancelled booking**: Still accessible (for records) with appropriate UI
4. **Deleted booking**: Hard delete (rare) → 404
5. **Multiple tabs**: Token validation is stateless, works in parallel

## Testing Strategy

### Unit Tests (`access-token.test.ts`)

```typescript
describe('AccessTokenService', () => {
  describe('generate', () => {
    it('creates valid HMAC token');
    it('embeds expiry timestamp');
    it('is URL-safe');
  });

  describe('validate', () => {
    it('accepts valid token for matching booking');
    it('rejects tampered signature');
    it('rejects expired token');
    it('rejects token for wrong booking');
  });

  describe('validateLegacy', () => {
    it('falls back to DB lookup for old tokens');
    it('handles null stored token gracefully');
  });
});
```

### Integration Tests (`api/bookings/[id]/route.test.ts`)

```typescript
describe('GET /api/bookings/{id}', () => {
  it('returns booking with valid HMAC token');
  it('returns booking with valid legacy token');
  it('returns 404 for non-existent booking');
  it('returns 401 without token or auth');
  it('returns 403 for token/booking mismatch');
  it('returns 410 for expired token');
  it('returns booking for authenticated owner');
  it('returns booking for restaurant staff');
});
```

## Rollout Plan

### Phase 1: Build (This PR)

- [ ] Implement `AccessTokenService`
- [ ] Update API handler to use new service
- [ ] Update email builder to use new tokens
- [ ] Add comprehensive tests
- [ ] Feature flag: `BOOKING_ACCESS_V2=true`

### Phase 2: Shadow Mode

- [ ] Generate both old and new tokens in emails
- [ ] Log which token type is used in access
- [ ] Monitor for issues

### Phase 3: Migration

- [ ] Default to new tokens only
- [ ] Keep legacy validation for 90 days
- [ ] Monitor legacy token usage

### Phase 4: Cleanup

- [ ] Remove legacy token validation
- [ ] Remove `confirmation_token` column (optional, can keep for audit)
- [ ] Update documentation

## Environment Variables

```bash
# Required: Secret for HMAC signing (32+ bytes, base64 encoded)
BOOKING_ACCESS_TOKEN_SECRET=<base64-encoded-secret>

# Optional: Token expiry in hours (default: 720 = 30 days)
BOOKING_ACCESS_TOKEN_EXPIRY_HOURS=720

# Feature flag: Enable v2 tokens (default: true after rollout)
BOOKING_ACCESS_V2=true
```

## File Changes Summary

| File                                   | Change                            |
| -------------------------------------- | --------------------------------- |
| `server/bookings/access-token.ts`      | NEW - Token service               |
| `server/bookings/access-token.test.ts` | NEW - Unit tests                  |
| `app/api/bookings/[id]/route.ts`       | UPDATE - Use new token service    |
| `app/api/bookings/[id]/route.test.ts`  | UPDATE - Add new test cases       |
| `server/emails/bookings.ts`            | UPDATE - Use new token generation |
| `lib/env.ts`                           | UPDATE - Add new env vars         |
| `.env.example`                         | UPDATE - Document new vars        |

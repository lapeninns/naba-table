---
task: guest-booking-access-revamp
timestamp_utc: 2025-12-24T01:24:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Guest Booking Access System Revamp

## Problem Statement

The current token-based booking access system has accumulated complexity through patches and fallbacks:

1. **Token lookup is the primary key** - System searches by `confirmation_token` column, not by booking ID
2. **Legacy bookings have null tokens** - Requires fallback logic
3. **Patched-on complexity** - Multiple code paths, hard to reason about
4. **Token generation inconsistency** - Not all booking creation paths generate tokens
5. **URL structure is suboptimal** - Token is in query string, not validated with booking ID

## Current Flow (Problematic)

```
Email Link: /bookings/{id}?token={token}
     │
     ▼
┌────────────────────────────────────┐
│ 1. Extract token from query        │
│ 2. Search DB by token (primary!)   │◄── Problem: Token is lookup key
│ 3. If not found → TOKEN_NOT_FOUND  │
│ 4. If booking.id !== url.id → 403  │
│ 5. Fallback: lookup by ID          │◄── Patch on top of patch
│ 6. If null token → backfill & serve│
└────────────────────────────────────┘
```

## Proposed Flow (Clean)

```
Email Link: /bookings/{id}?token={token}
     │
     ▼
┌────────────────────────────────────┐
│ 1. Lookup booking by ID (primary!) │◄── ID is the lookup key
│ 2. If not found → 404              │
│ 3. Determine access method:        │
│    a) User authenticated & owns it │
│    b) Token provided & valid       │
│ 4. Validate token against booking  │◄── Token is validation, not lookup
│ 5. Return booking with permissions │
└────────────────────────────────────┘
```

## Key Principles for Revamp

### 1. **ID-First Lookup**

- Booking ID is the primary identifier (already in URL)
- Token is an _authentication credential_, not a lookup key
- Always fetch by ID, then validate access

### 2. **Token as HMAC Signature**

Current: Random token stored in DB, compared with query param
Proposed: HMAC-based token derived from booking ID + secret

- No storage needed (stateless)
- Self-validating
- Can embed expiry in token
- Can regenerate anytime

### 3. **Clear Access Hierarchy**

```
Guest can access booking if:
  1. Authenticated user owns the booking (email match), OR
  2. Authenticated user is restaurant staff, OR
  3. Valid token provided (for unauthenticated access)
```

### 4. **Token Lifecycle**

- **Creation**: Generated at booking creation and stored
- **Validation**: Checked on access (expiry, booking match)
- **Renewal**: Can regenerate if needed (e.g., resend email)
- **Revocation**: Can invalidate (e.g., on cancel, suspicious activity)

## Options Analysis

### Option A: Keep Random Tokens (Status Quo + Cleanup)

**Pros**:

- Minimal migration
- Already partially working

**Cons**:

- Still requires DB storage
- Needs backfill for legacy
- Token leakage risk (if exposed, valid until expiry)

### Option B: HMAC-Based Tokens (Recommended)

**Pros**:

- Stateless (no DB column needed for lookup)
- Self-validating
- Can embed expiry, booking ID in token
- Regenerable without DB update
- Can't be guessed (cryptographically secure)

**Cons**:

- Breaking change for existing email links (need migration story)
- Requires secret key management

### Option C: Hybrid (HMAC with DB fallback)

**Pros**:

- Supports both old and new tokens during migration
- No breaking change

**Cons**:

- Temporary complexity during transition

## Recommended Direction

**Implement Option C (Hybrid)** for smooth migration:

1. **New token format**: HMAC-based, self-validating
2. **Old token support**: Fall back to DB lookup for legacy tokens
3. **Deprecation path**: After 90 days, remove old token support
4. **Migration**: New emails use HMAC tokens; old links still work

### HMAC Token Design

```typescript
// Token structure: base64url(bookingId.expiry.signature)
// Where signature = HMAC-SHA256(bookingId + expiry, SECRET_KEY)

function generateAccessToken(bookingId: string, expiryHours = 720): string {
  const expiry = Math.floor(Date.now() / 1000) + expiryHours * 3600;
  const payload = `${bookingId}.${expiry}`;
  const signature = createHmac('sha256', SECRET_KEY).update(payload).digest('base64url');
  return Buffer.from(`${payload}.${signature}`).toString('base64url');
}

function validateAccessToken(token: string, bookingId: string): boolean {
  const decoded = Buffer.from(token, 'base64url').toString();
  const [id, expiry, signature] = decoded.split('.');

  if (id !== bookingId) return false;
  if (Number(expiry) < Date.now() / 1000) return false;

  const expectedSignature = createHmac('sha256', SECRET_KEY)
    .update(`${id}.${expiry}`)
    .digest('base64url');
  return timingSafeEqual(signature, expectedSignature);
}
```

## Constraints & Risks

1. **Breaking existing email links**: Mitigated by hybrid approach
2. **Secret key management**: Use env var, rotate periodically
3. **Token expiry**: 30 days default, configurable
4. **PII exposure**: Tokens don't contain PII, only booking ID

## Open Questions

- [x] Should we support token "used_at" tracking? → No, HMAC tokens are stateless
- [x] What's the migration window for old tokens? → 90 days
- [ ] Do we need shorter/longer expiry for specific use cases? (owner: PM)

## External Resources

- [HMAC-SHA256 for token signing](https://nodejs.org/api/crypto.html#cryptocreatehmacalgorithm-key-options)
- [Timing-safe comparison](https://nodejs.org/api/crypto.html#cryptotimingsafeequala-b)

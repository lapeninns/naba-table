---
task: guest-booking-access-revamp
timestamp_utc: 2025-12-24T01:44:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

> Pending: Manual browser testing required after deployment

### Console & Network

- [ ] No Console errors on `/bookings/{id}` page
- [ ] Network request to `/api/bookings/{id}` returns correct response shape
- [ ] Access object present in API response

### DOM & Accessibility

- [ ] Link expired state displays correctly
- [ ] Access denied state displays correctly
- [ ] "Sign in" and "Try again" buttons are keyboard accessible
- [ ] Focus order is logical

### Performance

- [ ] Page loads within acceptable time
- [ ] No unnecessary re-renders

### Device Emulation

- [ ] Mobile (≈375px) - Link expired card renders correctly
- [ ] Tablet (≈768px) - Buttons stack/inline correctly
- [ ] Desktop (≥1280px) - Full layout displays

## Automated Test Outcomes

### Unit Tests: Access Token Service

```
✓ generateAccessToken > creates a token with correct format
✓ generateAccessToken > embeds correct expiry timestamp
✓ generateAccessToken > uses default expiry of 30 days
✓ generateAccessToken > produces URL-safe tokens
✓ generateAccessToken > generates different signatures for different booking IDs
✓ generateAccessToken > generates different signatures for different expiry times
✓ validateAccessToken > accepts valid token for matching booking
✓ validateAccessToken > rejects token for wrong booking ID
✓ validateAccessToken > rejects expired token
✓ validateAccessToken > rejects tampered signature
✓ validateAccessToken > rejects tampered expiry
✓ validateAccessToken > rejects tampered booking ID in token
✓ validateAccessToken > rejects malformed tokens
✓ validateAccessToken > returns correct expiry date
✓ isLegacyToken > detects new HMAC tokens
✓ isLegacyToken > detects legacy random tokens
✓ isLegacyToken > detects various legacy token formats
✓ mapTokenErrorToStatus > maps expired errors to 410
✓ mapTokenErrorToStatus > maps mismatch errors to 403
✓ mapTokenErrorToStatus > maps not found errors to 404
✓ mapTokenErrorToStatus > maps other errors to 401
✓ mapTokenErrorToMessage > returns non-empty messages for all error types
✓ mapTokenErrorToMessage > returns user-friendly expiry message
✓ mapTokenErrorToMessage > returns user-friendly mismatch message

Total: 24 tests ✅
```

### Integration Tests: Booking API Access

```
✓ ID-First Lookup > should return 404 when booking does not exist
✓ ID-First Lookup > should lookup booking by ID even when invalid token provided
✓ Access Level - Owner > should grant owner access when authenticated user email matches
✓ Access Level - Owner > should return canModify: true for confirmed bookings
✓ Access Level - Owner > should return canModify: false for completed bookings
✓ Access Level - Token > should grant token access when valid HMAC token provided
✓ Access Level - Token > should grant token access when valid legacy token provided
✓ Access Level - Token > should return 410 for expired HMAC token
✓ Access Level - Token > should return 401 for tampered token
✓ Access Level - Token > should return 403 for token with wrong booking ID
✓ Response Shape > should include access object in response
✓ Response Shape > should exclude sensitive token fields from response
✓ Error Responses > should return user-friendly message for expired token
✓ Error Responses > should return 401 when no token and no authentication
✓ Error Responses > should return 403 when authenticated user does not own booking
✓ Legacy Token Fallback > should fall back to legacy validation for non-v2 tokens
✓ Legacy Token Fallback > should backfill token for bookings with null confirmation_token
✓ Access Permissions by Status > should allow modification for pending booking
✓ Access Permissions by Status > should allow modification for pending_allocation booking
✓ Access Permissions by Status > should allow modification for confirmed booking
✓ Access Permissions by Status > should deny modification for seated booking
✓ Access Permissions by Status > should deny modification for completed booking
✓ Access Permissions by Status > should deny modification for cancelled booking

Total: 23 tests ✅
```

### TypeScript Compilation

```
✓ No TypeScript errors
✓ All imports resolve correctly
✓ Types are properly exported
```

### Build Verification

```
✓ pnpm build completed successfully
✓ No build warnings related to changes
```

## Artifacts

- Unit test results: `47/47 passed`
- TypeScript check: `0 errors`
- Build: `success`

## Known Issues

None identified during implementation.

## Security Considerations

- [x] HMAC uses crypto.createHmac with SHA-256
- [x] Timing-safe comparison prevents timing attacks
- [x] Secret key validation (minimum 32 characters)
- [x] Token fields excluded from API response
- [x] Fallback secret disabled in production

## Backward Compatibility

- [x] Legacy tokens continue to work via DB lookup
- [x] Existing email links function during migration
- [x] `canManage` prop still works as fallback
- [x] API response maintains existing `booking` shape

## Sign-off

- [ ] Engineering review
- [ ] Security review (HMAC implementation)
- [ ] QA (manual browser testing)

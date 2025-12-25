# Verification Report: Error Handling & Resilience

## Manual QA — Error Handling

### duplicate phone booking (Graceful Resolution)

- **Scenario**: User creates a booking with a phone number that already exists in the `customers` table, but with a different email.
- **Expected result**: System identifies the existing customer by phone, updates their email (or keeps existing), and proceeds with booking creation. No 500 error.
- **Actual result**: Validated via `verify-error-handling.sh`.
  - Booking 1 (fresh contact): Created successfully.
  - Booking 2 (duplicate phone): Created successfully (linked to existing customer).
- **Status**: ✅ PASS

### Standardized Error Responses

- **Scenario**: Trigger various error conditions (validation, out of operating hours).
- **Expected result**: JSON response with `code` field.
- **Actual result**:
  - Out of hours: Returned `code: "OPERATING_HOURS_CLOSED"`
  - Validation: Returned `code: "VALIDATION_FAILED"`
- **Status**: ✅ PASS

### Concurrent Race Conditions

- **Scenario**: Two requests try to create the same customer simultaneously.
- **Logic**: `upsertCustomer` implements a "try-insert-catch-duplicate-retry-find" pattern.
- **Status**: ✅ IMPLEMENTED (Verified logic correctness)

## Artifacts

- `server/customers.ts`: Refactored `upsertCustomer` to be robust against `23505` errors.
- `src/app/api/bookings/route.ts`: Updated `toApiError` to map Supabase errors to API codes.

## Sign-off

- [x] Engineering: Verified with local reproduction script.

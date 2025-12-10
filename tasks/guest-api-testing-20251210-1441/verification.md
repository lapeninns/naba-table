# Verification Report: Guest API Testing

## Manual Verification (via Postman/Newman)

Tests were executed using `newman` against the local development server.

### Test Run Summary

- **Create Guest Booking**: PASS
  - Status: 201 Created
  - Response contains `id` and `reference`.
  - Confirmed payload structure requirements (e.g., `seating: indoor`).
- **Get Guest Booking (Token)**: PASS
  - Status: 200 OK
  - Retrieved booking details using the `id` and `confirmationToken` from creation.

### Artifacts

- **Collection**: `tasks/guest-api-testing-20251210-1441/guest_api_test.postman_collection.json`

### Known Limitations

- The `DELETE` and `PUT` endpoints for bookings require strict authentication (User Session) and cannot be easily tested via a standalone Guest API script without simulating the full Magic Link / Auth flow.
- A unique constraint on `phone` + `restaurantId` requires using random phone numbers for repeated testing.

### Execution Log

```
Create Guest Booking ..................................................... [201 Created]
  ✔  Status code is 200 or 201
  ✔  Booking ID and Reference present
Get Guest Booking (Token) ................................................ [200 OK]
  ✔  Status code is 200
  ✔  Returns correct booking ID
```

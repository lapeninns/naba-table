# Research: Guest API Testing

## Requirements

- Perform API tests for Guest facing CRUD operations.
- Use Postman (Collection + Verification).

## Existing Patterns

- API Routes located in `src/app/api`.
- Guest logic allows creating bookings without Auth (using `guestLookup` or just payload).
- Retrieval uses `token` (Reference or Confirmation Token).

## API Endpoints identified

- `POST /api/bookings`: Create Booking.
- `GET /api/bookings/[id]`: Get Booking (requires token).
- `PUT /api/bookings/[id]`: Update Booking (requires Auth or specific permissions).
- `DELETE /api/bookings/[id]`: Cancel Booking (requires Auth).

## Constraints

- Authentication is difficult to automate without a valid user/session in this environment.
- We will focus on the "Unauthenticated Guest" flow (Create, Read).
- Update/Delete for guests often happens via "Edit" links which might use a different flow or token, but the API seems to enforce Auth.
  - Correction: `GET /api/bookings/[id]` supports token.
  - `PUT` allows `dashboardUpdateSchema` (minimal) IF `isPendingBookingLocked` is false.
  - Wait, `processDashboardUpdate` also checks permissions. `validateConfirmationToken` is NOT used in `PUT`.
  - It seems `PUT` strictly requires `requireSession` or tenant auth?
  - Let's re-read `bookings/[id]/route.ts`.
  - `PUT`: `handleDashboardUpdate` or `updateBookingRecord`.
  - `processDashboardUpdate` calls `requireSession`. So yes, PUT requires session.
  - **Conclusion**: Guest "Edit" likely happens via a Magic Link that logs them in, OR there is a separate "guest modification" flow I missed.
  - Check `src/server/bookings/modification-flow.ts`?
  - Or `src/app/api/bookings/[id]/request-edit/route.ts`?

## Plan

1. Create `guest_api_test.postman_collection.json`.
2. Include "Create Booking" and "Get Booking Details" (Guest View).
3. Attempt "Update" if possible, but likely document limitation.
4. Run tests using `npx newman`.

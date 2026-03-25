# Continuity Ledger

Last updated: 2026-03-25T17:35:10Z

## Goal (incl. success criteria)

- Switch The Old School House map link to a destination-only directions URL so Google Maps can use the customer's live location when available.
- Keep the current Google review link unchanged.

## Constraints/Assumptions

- Follow SDLC phases and maintain task artifacts before code edits.
- Production write: use explicit confirmation guards and verify the production project ref before any mutation.
- Keep slug unchanged.
- Use a destination-only Google Maps directions URL so the app/device can infer current location at open time.

## Key decisions

- Target restaurant ID: `a120da71-ba6d-446f-a33a-2e78787abcb0`.
- Keep slug `the-old-school-house`.
- Keep `google_review_url` as `https://search.google.com/local/writereview?placeid=ChIJbbeIWMQBd0gRTk6up33n664`.
- Set `google_map_url` to `https://www.google.com/maps/dir/?api=1&destination=The+Old+School+House,+London+Rd,+Stony+Stratford,+Milton+Keynes+MK11+1JA&travelmode=driving`.

## State

- Phase 4 verification complete for the live-location map follow-up.

## Done

- Confirmed the need to replace the fixed-origin directions link with a destination-only link.
- Created `tasks/update-old-school-house-live-location-map-production-20260325-1733/`.
- Dry-ran the metadata update with the destination-only directions URL.
- Applied the production map-link update successfully.
- Verified the stored map link is destination-only and the review link is unchanged.

## Now

- Prepare the final production summary for the user.

## Next

- None.

## Open questions (UNCONFIRMED if needed)

- None at the moment.

## Working set (files/ids/commands)

- `CONTINUITY.md`
- `tasks/update-old-school-house-live-location-map-production-20260325-1733/`
- `scripts/update-restaurant-metadata.ts`
- `.env.vercel-production.live`

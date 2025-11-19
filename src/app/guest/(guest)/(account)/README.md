# Guest Account Routes

- **Audience:** authenticated diners managing bookings, invites, and profile data.
- **Auth:** Required. Middleware + server components redirect unauthenticated visitors to `/signin`.
- **Chrome:** Shares the marketing navigation/footer to keep continuity while surfacing account tools.
- **Recovery:** Scoped `error.tsx`/`not-found.tsx` keep incidents out of ops and marketing pages.

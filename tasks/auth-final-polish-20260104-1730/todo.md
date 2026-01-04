# Implementation Checklist

## Fixes

- [ ] Update `src/app/(public)/auth/signin/page.tsx` to include `redirectedFrom` in the restaurant sign-in CTA link.

## Verification

- [ ] Verify `ImplicitAuthHandler.tsx` handles post-login redirect for Guests.
- [ ] Verify `ImplicitAuthHandler.tsx` handles post-login redirect for Owners (it should be used in both layouts).
- [ ] Manual E2E Flow: Guest Happy Path.
- [ ] Manual E2E Flow: Owner Happy Path.
- [ ] Final Grep for any legacy `/login` paths.
- [ ] Final Grep for any legacy logo references.

## Documentation

- [ ] Ensure `docs/restaurant-facing-routes.md` matches the implemented flow.
- [ ] Update `CONTINUITY.md` with final results.

## Notes

- The `ImplicitAuthHandler` should be present in both the Guest and App layouts.

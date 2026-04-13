Immediate root cause:

- `server/bookings/manage-url.ts` returned `/bookings/recover/error?code=MISSING_ACCESS_TOKEN` unless both `customer_email` and `customer_phone` were present.

Deeper contract mismatch:

- `src/app/api/ops/bookings/schema.ts` and `src/app/api/ops/bookings/route.ts` intentionally allow ops walk-in bookings with only one contact method.
- `server/security/session-recovery-access-token.ts` previously required both email and phone in the signed guest recovery token.
- Token-protected guest booking routes under `src/app/api/bookings/**` and `src/app/api/reservations/[id]/confirmation/route.ts` also rejected booking access unless both booking contact fields existed and matched.

Conclusion:

- Phone-only ops bookings were valid to create but impossible to manage through the SMS guest-link flow.
- The correct fix is to make the session-recovery contract accept at least one contact method and apply the same contact-match rule everywhere that consumes the token.

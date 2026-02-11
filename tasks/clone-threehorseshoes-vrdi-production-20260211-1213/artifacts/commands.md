# Command Summary

- Environment sourced from `.env.vercel-production` for all writes.
- Clone run via `scripts/seed-railway-from-cornerhouse.ts --apply` with:
  - `CONFIRM_PRODUCTION=true`
  - `EXPECTED_PROJECT_REF=vrdiqfudmwydclqpydee`
- Profile fields updated via service-role `restaurants` update.
- Synthetic seeding executed for 15 future days.
- Access grant executed via `scripts/grant-restaurant-access.ts` using `USER_ID` path due `listUsers(perPage=200)` failure on this project.

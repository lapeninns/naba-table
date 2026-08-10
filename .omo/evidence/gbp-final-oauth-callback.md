# Google Business Profile canonical OAuth callback evidence

Captured: 2026-08-10

## Canonical completion binds the exact tenant

- Scenario: A canonical callback with a versioned HttpOnly cookie whose state token exactly matches the query state completes with the cookie's `restaurantId` as `expectedRestaurantId`.
- Invocation: `./node_modules/.bin/vitest run tests/server/google-business-profile-oauth-state-cookie.test.ts tests/server/google-business-profile-callback-route.test.ts tests/server/google-business-profile-service-oauth-state.test.ts tests/server/google-business-profile-service-authorization-flow.test.ts tests/server/google-business-profile-service-authorization-runtime.test.ts tests/server/restaurant-google-business-profile-routes.test.ts tests/server/restaurant-google-business-v1-routes.test.ts --reporter=verbose`
- Binary observable: `7 passed`, `67 passed`; callback assertion observed `completeGoogleBusinessProfileAuthorization({ stateToken: 'test-state', code: 'test-code', requestedByUserId: 'user-1', expectedRestaurantId: 'rest-1' })`.
- Artifact: this file; source assertions live in `tests/server/google-business-profile-callback-route.test.ts` and `tests/server/google-business-profile-oauth-state-cookie.test.ts`.

## Attack and compatibility rejection paths

- Scenario: malformed legacy raw cookies and exact-state mismatches return no tenant; service ownership checks reject a state for a different restaurant; legacy per-restaurant callback retains its route-tenant binding.
- Invocation: same focused Vitest command above.
- Binary observable: cookie tests passed for malformed, legacy, and mismatched state values; OAuth state domain test passed for different-route-restaurant rejection; legacy callback tests passed for matching and cross-tenant states.
- Artifact: this file; test output recorded above and test sources named above.

## Static and diff gates

- Scenario: changed TypeScript is type-safe, lint-clean, formatted, and has no whitespace errors.
- Invocation: `./node_modules/.bin/eslint server/google-business-profile/oauth-state-cookie.ts src/app/api/ops/google-business-profile/callback/route.ts src/app/api/ops/restaurants/'[id]'/google-business-profile/connect/route.ts src/app/api/ops/restaurants/'[id]'/google-business/connect/route.ts tests/server/google-business-profile-oauth-state-cookie.test.ts tests/server/google-business-profile-callback-route.test.ts tests/server/restaurant-google-business-profile-routes.test.ts tests/server/restaurant-google-business-v1-routes.test.ts && ./node_modules/.bin/prettier --check server/google-business-profile/oauth-state-cookie.ts src/app/api/ops/google-business-profile/callback/route.ts src/app/api/ops/restaurants/'[id]'/google-business-profile/connect/route.ts src/app/api/ops/restaurants/'[id]'/google-business/connect/route.ts tests/server/google-business-profile-oauth-state-cookie.test.ts tests/server/google-business-profile-callback-route.test.ts tests/server/restaurant-google-business-profile-routes.test.ts tests/server/restaurant-google-business-v1-routes.test.ts && ./node_modules/.bin/tsc --noEmit && git diff --check`
- Binary observable: exit 0; Prettier reported `All matched files use Prettier code style!`; TypeScript, ESLint, and `git diff --check` emitted no findings.
- Artifact: this file.

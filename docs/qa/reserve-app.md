# Reserve App QA

Sprint 10 adds a focused local entrypoint for the standalone Vite reservation app and reservation contracts:

```sh
pnpm run qa:reserve-app
```

The command runs:

- `pnpm run reserve:build` to prove the Vite app builds.
- reserve API/client contract tests for error payloads, capacity alternatives, schedule normalization, slots, and reservation adapters.
- reserve wizard unit tests for draft storage, stale restaurant-scoped drafts, contact validation, review-step capacity recovery, and timeout matching.
- `tests/e2e/guest-reserve-routes.spec.ts` with `playwright.reserve.config.ts` for shipped Reserve route proof, including root/new/detail/not-found routes, a restaurant-scoped plan-step party/time interaction, details-step contact validation, and mocked review-submit capacity alternatives.
- a command-composition QA test so the selector stays intentional.

This suite uses mocked browser routes and local Vitest mocks. The browser capacity flow intercepts `POST /api/bookings` and returns a deterministic capacity response with alternative slots, so it must not submit real reservations to production or staging. Data-creating Reserve browser coverage remains mocked unless a future local/staging-like run is explicitly configured with cleanup by `QA_RUN_ID`.

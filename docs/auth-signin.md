# Sign-in Flow Reference

This document captures the updated authentication flow implemented for US-007, including runtime configuration, test coverage, and analytics events.

## Environment

The sign-in experience relies on the existing Supabase project configuration. Ensure the following environment variables are set before running locally or in CI:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_JWT_SECRET`

The env validator (`pnpm run validate:env`) already checks for these keys. No new secrets were introduced in this change set.

## Testing

| Scenario                      | Command                                                                                                                                                                             | Notes                                             |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Unit tests                    | `pnpm vitest components/auth/__tests__/SignInForm.test.tsx`                                                                                                                         | Mocks Supabase + magic-link behaviours.           |
| Auth callback route           | `pnpm vitest app/api/auth/callback/route.test.ts`                                                                                                                                   | Ensures redirect + session exchange.              |
| Wizard profile regressions    | `pnpm vitest reserve/tests/profile/ProfileManageForm.test.tsx reserve/tests/profile/useUpdateProfile.test.tsx`                                                                      | Covers duplicate/idempotency edge cases.          |
| Wizard offline + error states | `pnpm vitest reserve/features/reservations/wizard/ui/__tests__/BookingWizard.plan-review.test.tsx reserve/features/reservations/wizard/ui/__tests__/BookingWizard.offline.test.tsx` | Validates skeleton + optimistic failure handling. |
| Mutation hook behaviour       | `pnpm vitest reserve/features/reservations/wizard/api/__tests__/useCreateReservation.test.tsx`                                                                                      | Confirms analytics + idempotency behaviour.       |
| Playwright profile flows      | `pnpm playwright test tests/e2e/profile/avatar-upload.spec.ts`                                                                                                                      | Requires authenticated storage state.             |
| Playwright wizard failure     | `pnpm playwright test tests/e2e/reservations/booking-flow.spec.ts`                                                                                                                  | Requires populated Supabase dataset.              |

## Analytics Events

The following events were added or updated and are emitted via `track`/`emit`:

- `wizard_offline_detected` — fired when the wizard transitions from online to offline.
- `wizard_submit_failed` — fired when reservation submission fails (includes status/code payload).
- `auth_signin_viewed` — fired when the sign-in form mounts (includes `redirectedFrom`).
- `auth_signin_attempt` — fired for each magic-link request (`method: 'magic_link'`).
- `auth_signin_error` — fired when Supabase returns an error for the OTP request.
- `auth_magiclink_sent` — fired after successfully requesting a magic link.

All analytics payloads omit undefined fields and include the redirect target when available.

## Playwright Fixture Notes

- Profile specs reuse the existing authenticated fixture (`tests/fixtures/auth.ts`). Ensure `PLAYWRIGHT_AUTH_STATE_PATH` or default `.auth/default.json` is present.
- Wizard specs require `NEXT_PUBLIC_RESERVE_V2=true` and at least one restaurant row in Supabase.

For additional context see `components/auth/SignInForm.tsx` and `reserve/features/reservations/wizard/ui/BookingWizard.tsx`.

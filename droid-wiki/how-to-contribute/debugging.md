# Debugging

For host or redirect bugs, start in `src/proxy.ts` and `next.config.js`. For API bugs, start in `src/app/api/**/route.ts` and follow into `server/**`. For env failures, run `pnpm validate:env` and inspect `config/env.schema.ts`, `lib/env.ts`, and `scripts/validate-env.ts`.

## Fast paths

| Symptom                     | First files to inspect                                                            |
| --------------------------- | --------------------------------------------------------------------------------- |
| App/root host mismatch      | `src/proxy.ts`, `tests/e2e/ops-app-host-redirects.spec.ts`                        |
| Ops API auth failure        | `src/proxy.ts`, `server/auth/ops-guard.ts`, target `src/app/api/ops/**/route.ts`  |
| Booking create/update issue | `src/app/api/bookings/**`, `server/bookings/**`, `server/capacity/**`             |
| Delivery issue              | `server/emails/**`, `server/sms/**`, `server/queue/**`, webhook routes            |
| GBP/dual-sync issue         | `server/google-business-profile/**`, `server/dual-sync/**`, ops restaurant routes |

Related: [How to monitor](../how-to-monitor/index.md).

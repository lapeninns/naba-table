# Ops Rate Limiter Configuration

The Ops console throttles high-volume endpoints (e.g., bookings list, walk-in creation) using the shared rate limiter in `server/security/rate-limit.ts`. For multi-instance safety, we rely on Upstash Redis. When credentials are missing, the limiter falls back to an in-memory store; in development we now bypass rate limiting entirely (no warnings) unless you opt in via `ENABLE_RATE_LIMIT_IN_DEV=true`.

## Required Environment Variables

Set these variables for every deployment target (staging and production):

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Both values are available from the Upstash console. Missing credentials trigger a warning in test/production and force the memory fallback. In development the limiter is disabled by default, but setting `ENABLE_RATE_LIMIT_IN_DEV=true` restores the previous behaviour for local smoke testing.

## Deployment Checklist

1. Confirm credentials are present in the environment (e.g., `vercel env ls`, Kubernetes secret, etc.).
2. Run `pnpm run validate:env` locally or in CI to ensure variables parse correctly.
3. In staging, hit an Ops API route (e.g., `/api/ops/bookings`) and verify logs report `source: "redis"` in the rate limit response.
4. If the warning appears or `source` remains `"memory"`, double-check the secrets and redeploy before promoting to production.

## Local Development Notes

- When credentials are absent locally, the limiter defaults to **disabled**; set `ENABLE_RATE_LIMIT_IN_DEV=true` if you need to exercise throttling logic against the in-memory store.
- When the limiter is enabled without credentials (dev override or test/prod), the warning only appears once per session to reduce noise; clear the console or reload to verify after changes.
- The fallback still enforces limits per process, so adjust tests that exercise rate limiting accordingly.

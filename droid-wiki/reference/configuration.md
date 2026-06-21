# Configuration

Configuration is parsed by `config/env.schema.ts` and `lib/env.ts`, checked by `scripts/validate-env.ts`, and documented in `.env.example` and `README.md`.

## Important groups

| Group          | Examples                                                                                                              |
| -------------- | --------------------------------------------------------------------------------------------------------------------- |
| Host/app       | `NEXT_PUBLIC_ROOT_DOMAIN`, `NEXT_PUBLIC_LOCAL_APP_HOSTS`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SITE_URL`               |
| Supabase       | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_READ_REPLICA_URL` |
| Safety markers | `APP_ENV`, `DB_TARGET_ENV`, `PRODUCTION_*`, `ALLOW_PROD_RESOURCES_IN_NONPROD`, `ALLOW_PROD_DB_WIPE`                   |
| Delivery       | `RESEND_*`, `TWILIO_*`, `CLOUDFLARE_EMAIL_QUEUE_GATEWAY_*`, `BOOKING_SHORT_LINKS_*`                                   |
| Integrations   | `GOOGLE_BUSINESS_*`, `GOOGLE_CLOUD_QUOTA_PROJECT`, `POSTHOG_*`                                                        |
| Feature flags  | `FEATURE_*`, `NEXT_PUBLIC_FEATURE_*`                                                                                  |

Public environment names that look secret-bearing are blocked unless allowlisted in `config/env.schema.ts`.

Related: [Feature flags](../primitives/feature-flags.md), [Supabase remote policy](../background/supabase-remote-policy.md).

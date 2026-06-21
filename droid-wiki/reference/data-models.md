# Data models

Supabase migrations under `supabase/migrations/**` define database shape; this snapshot found 91 tracked SQL migration files, including `CONSOLIDATED_ALL_MIGRATIONS.sql`.

## Important model areas

| Area                      | Source                                                                                 |
| ------------------------- | -------------------------------------------------------------------------------------- |
| Bookings                  | `server/bookings.ts`, `server/bookings/**`, booking API routes                         |
| Restaurants               | `server/restaurants/**`, public and ops restaurant routes                              |
| Capacity/tables           | `server/capacity/**`, table/zones ops routes, table-assignment RPC migrations          |
| Delivery                  | `server/emails/**`, `server/sms/**`, `server/queue/**`, webhook routes                 |
| Dual sync and GBP         | `server/dual-sync/**`, `server/google-business-profile/**`, recent May 2026 migrations |
| Security and service RPCs | `supabase/migrations/20260527111100_harden_service_only_rpc_privileges.sql`            |

Recent May 2026 migrations cover menu hierarchy, overnight operating hours, soft-hold authorization, atomic schedule replacements, atomic business-context replacements, table inventory deletion guards, canonical GBP business info, food menu import reviews, booking modification cleanup, customer profile aggregates, email retry metadata, profile update idempotency, and service-only RPC privilege hardening.

Related: [Booking](../primitives/booking.md), [Restaurant](../primitives/restaurant.md).

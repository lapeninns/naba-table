# Glossary

| Term       | Meaning                                                                    | Source                                                    |
| ---------- | -------------------------------------------------------------------------- | --------------------------------------------------------- |
| App host   | Restaurant-operator host, usually `app.<root-domain>`.                     | `src/proxy.ts`                                            |
| Root host  | Public/guest host for marketing, booking, and guest account flows.         | `src/proxy.ts`, `src/app/(public)/**`                     |
| Ops        | Authenticated restaurant operator surface.                                 | `src/app/app/**`                                          |
| Guest      | Diner-facing account and public booking surface.                           | `src/app/guest/**`, `src/app/(public)/**`                 |
| Restaurant | Tenant/business entity used by bookings, team, settings, and integrations. | `server/restaurants/**`                                   |
| Booking    | Reservation lifecycle record.                                              | `server/bookings.ts`                                      |
| Soft hold  | Temporary table/capacity allocation before confirmation.                   | `server/capacity/table-assignment/soft-holds.ts`          |
| Turn band  | Restaurant policy for duration/capacity windows.                           | `server/restaurants/turnBands.ts`                         |
| GBP        | Google Business Profile integration.                                       | `server/google-business-profile/**`                       |
| Dual sync  | Sync state between Nabatable and external provider data.                   | `server/dual-sync/**`                                     |
| Luma       | Shared Radix/shadcn theme.                                                 | `tailwind.config.js`, `scripts/check-luma-compliance.mjs` |

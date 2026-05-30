# Glossary

| Term       | Meaning                                                                            | Source                                                    |
| ---------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------- |
| App host   | Restaurant-operator host, usually `app.<root-domain>`.                             | `src/proxy.ts`                                            |
| Root host  | Public and guest host for marketing, booking, auth, and guest account flows.       | `src/proxy.ts`, `src/app/(public)/**`, `src/app/guest/**` |
| Ops        | Authenticated restaurant operator surface.                                         | `src/app/app/**`                                          |
| Guest      | Diner-facing account and public booking surface.                                   | `src/app/guest/**`, `src/app/(public)/**`                 |
| Restaurant | Tenant/business entity used by bookings, teams, settings, menus, and integrations. | `server/restaurants/**`                                   |
| Booking    | Reservation lifecycle record used by public, guest, and ops flows.                 | `server/bookings.ts`, `server/bookings/**`                |
| Soft hold  | Temporary table/capacity allocation before confirmation or manual assignment.      | `server/capacity/table-assignment/soft-holds.ts`          |
| Turn band  | Restaurant policy for duration and capacity windows.                               | `server/restaurants/turnBands.ts`                         |
| GBP        | Google Business Profile integration.                                               | `server/google-business-profile/**`                       |
| Dual sync  | Sync state and publish flow between Nabatable and external provider data.          | `server/dual-sync/**`                                     |
| Luma       | Shared Radix/shadcn theme and UI token baseline.                                   | `components/ui/**`, `scripts/check-luma-compliance.mjs`   |
| Reserve    | Standalone reservation wizard built with Vite and React Router.                    | `reserve/**`                                              |

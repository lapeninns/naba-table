# Routing host split

`src/proxy.ts` implements the root-host/app-host split.

| Host context             | Surface                                                                                       | Source                                    |
| ------------------------ | --------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Root host                | Marketing, public booking, guest auth/account, public booking management, and harness routes. | `src/app/(public)/**`, `src/app/guest/**` |
| App host                 | Restaurant operator app and app-host ops transport.                                           | `src/app/app/**`                          |
| Shared API host behavior | Public APIs, guarded ops APIs, callbacks, webhooks, and cron routes.                          | `src/app/api/**`, `src/proxy.ts`          |

Ops APIs remain guarded even when requested directly. Any change to `src/proxy.ts`, auth gates, redirects, rewrites, or host expectations needs route/API identity rows and high-risk verification.

Related: [Host routing](../systems/host-routing.md).

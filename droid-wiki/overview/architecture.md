# Architecture

Nabatable is host-aware. `src/proxy.ts` separates the app host for restaurant operators from the root host for public and guest traffic, while API handlers under `src/app/api/**` delegate to domain modules under `server/**`.

```mermaid
graph LR
  Guest[Root host guests] --> Public[src/app/(public) and src/app/guest]
  Operator[App host operators] --> Ops[src/app/app]
  Public --> API[src/app/api]
  Ops --> API
  Reserve[reserve Vite app] --> API
  API --> Domain[server/*]
  Domain --> DB[(Remote Supabase)]
  Domain --> Email[Resend]
  Domain --> SMS[Twilio]
  Domain --> GBP[Google Business Profile]
  Cron[Vercel cron] --> API
  Workers[Cloudflare Workers] --> API
```

## Layers

| Layer            | Key files                                            | Role                                                                                             |
| ---------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Routing          | `src/proxy.ts`, `next.config.js`                     | Host split, redirects, app-host rewrites, trusted ops headers, and ops auth checks.              |
| Pages            | `src/app/**`, `reserve/**`                           | Public, guest, ops, harness, and standalone reservation UI.                                      |
| Browser services | `src/services/**`, `src/hooks/**`, `src/contexts/**` | React Query hooks, typed fetch wrappers, and service providers.                                  |
| Domain services  | `server/**`, `lib/**`                                | Booking, capacity, auth, restaurants, delivery, sync, jobs, security, and provider integrations. |
| Data             | `supabase/migrations/**`, `types/supabase.ts`        | Remote Supabase schema, RPC history, generated types, and service-role hardening.                |

This snapshot has 4059 tracked files, 2804 tracked JS/TS source-like files, 676 tracked files under `tests/**`, 140 API route handlers, 82 tracked `page.tsx` files, and 91 SQL migration files. See [By the numbers](../by-the-numbers.md).

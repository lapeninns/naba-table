# Architecture

Nabatable is host-aware: `src/proxy.ts` separates the app host for restaurant operators from the root host for guests and public visitors. Route handlers under `src/app/api/**` call domain modules under `server/**`, and those modules use Supabase, Resend, Twilio, Google Business Profile, and Cloudflare helpers.

```mermaid
graph LR
  Guest[Guest/root host] --> Public[src/app/(public) and src/app/guest]
  Operator[Operator/app host] --> Ops[src/app/app]
  Public --> API[src/app/api]
  Ops --> API
  Reserve[reserve Vite app] --> API
  API --> Domain[server/*]
  Domain --> DB[(Supabase)]
  Domain --> Email[Resend]
  Domain --> SMS[Twilio]
  Domain --> GBP[Google Business Profile]
  Cron[Vercel cron] --> API
  Workers[Cloudflare Workers] --> API
```

## Layers

| Layer            | Key files                                            | Role                                                        |
| ---------------- | ---------------------------------------------------- | ----------------------------------------------------------- |
| Routing          | `src/proxy.ts`, `next.config.js`                     | Host split, redirects, ops API rewrites, auth checks.       |
| Pages            | `src/app/**`, `reserve/**`                           | Public, guest, ops, and standalone reservation UI.          |
| Browser services | `src/services/**`, `src/hooks/**`, `src/contexts/**` | React Query hooks and typed fetch wrappers.                 |
| Domain services  | `server/**`, `lib/**`                                | Booking, capacity, auth, restaurants, delivery, sync, jobs. |
| Data             | `supabase/migrations/**`                             | Remote Supabase schema and RPC history.                     |

This snapshot has 1680 source files, 192 test files, 128 config/tooling files, 122 API routes, 47 page components, and 54 Supabase migrations. See [By the numbers](../by-the-numbers.md).

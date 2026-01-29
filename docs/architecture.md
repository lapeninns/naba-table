# System Architecture

Last updated: 2026-01-29

## Overview

SajiloReserveX (Nabatable) is a Next.js 14+ restaurant reservation platform with real-time capabilities.

## High-Level Architecture

```mermaid
flowchart TB
    subgraph Client["Client Layer"]
        Web["Web App<br/>(Next.js App Router)"]
        Guest["Guest Portal"]
        Ops["Ops Dashboard"]
    end

    subgraph Edge["Edge Layer (Vercel)"]
        MW["Middleware<br/>(Auth, Geo, A/B)"]
        Edge_Fn["Edge Functions"]
    end

    subgraph API["API Layer"]
        Routes["API Routes<br/>(/api/*)"]
        Actions["Server Actions"]
        RSC["React Server Components"]
    end

    subgraph Services["External Services"]
        Supabase["Supabase<br/>(PostgreSQL + Auth + Realtime)"]
        Sentry["Sentry<br/>(Error Tracking + Profiling)"]
        Resend["Resend<br/>(Transactional Email)"]
        PostHog["PostHog<br/>(Product Analytics)"]
        Vercel["Vercel<br/>(Hosting + Edge)"]
    end

    subgraph Data["Data Layer"]
        PG["PostgreSQL<br/>(via Supabase)"]
        Realtime["Supabase Realtime<br/>(WebSocket)"]
        Storage["Supabase Storage<br/>(Assets)"]
    end

    Web --> MW
    Guest --> MW
    Ops --> MW
    MW --> Routes
    MW --> RSC
    Routes --> Supabase
    Actions --> Supabase
    RSC --> Supabase
    Routes --> Resend
    Routes --> Sentry
    Web --> PostHog
    Supabase --> PG
    Supabase --> Realtime
    Supabase --> Storage
    Edge_Fn --> Sentry
```

## Data Flow

### Booking Flow

```mermaid
sequenceDiagram
    participant G as Guest
    participant W as Web App
    participant A as API Route
    participant S as Supabase
    participant E as Email (Resend)

    G->>W: Submit booking form
    W->>A: POST /api/bookings
    A->>S: Validate & insert booking
    S-->>A: Booking created
    A->>E: Queue confirmation email
    E-->>G: Send email
    A-->>W: Return booking details
    W-->>G: Show confirmation
```

### Real-time Updates

```mermaid
sequenceDiagram
    participant O as Ops Dashboard
    participant R as Supabase Realtime
    participant D as Database

    O->>R: Subscribe to bookings channel
    D->>R: Booking status change (trigger)
    R-->>O: Push update via WebSocket
    O->>O: Update UI state
```

## Component Architecture

### Frontend Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (guest)/           # Guest-facing routes (public)
│   ├── (auth)/            # Auth routes (login, signup)
│   ├── ops/               # Ops dashboard (protected)
│   └── api/               # API routes
├── components/
│   ├── ui/                # Shadcn UI primitives
│   ├── features/          # Feature-specific components
│   └── layouts/           # Layout components
├── lib/                   # Shared utilities
├── hooks/                 # React hooks
└── styles/                # Global styles
```

### Key Modules

| Module    | Purpose                   | Key Files                      |
| --------- | ------------------------- | ------------------------------ |
| Auth      | Supabase Auth integration | `lib/auth.ts`, `middleware.ts` |
| Bookings  | Reservation management    | `features/reservations/`       |
| Real-time | WebSocket subscriptions   | `hooks/use-realtime.ts`        |
| Email     | Transactional emails      | `lib/email/`, `server/email/`  |
| Analytics | Product analytics         | `lib/posthog.ts`               |

## Security Architecture

```mermaid
flowchart LR
    subgraph Public["Public Zone"]
        Guest["Guest Routes"]
        Auth["Auth Routes"]
    end

    subgraph Protected["Protected Zone"]
        Ops["Ops Dashboard"]
        API["Protected APIs"]
    end

    subgraph Backend["Backend Services"]
        Supabase["Supabase<br/>(RLS Policies)"]
        Secrets["Env Secrets"]
    end

    Guest --> Auth
    Auth -->|Session Cookie| Protected
    Protected -->|JWT| Supabase
    Supabase --> Secrets
```

### Security Controls

1. **Authentication**: Supabase Auth with magic link + OTP
2. **Authorization**: Row-Level Security (RLS) in PostgreSQL
3. **Session Management**: HTTP-only cookies, secure flag in production
4. **Secret Management**: Environment variables via Vercel
5. **Input Validation**: Zod schemas at API boundaries

## Observability Stack

| Layer          | Tool             | Purpose                            |
| -------------- | ---------------- | ---------------------------------- |
| Error Tracking | Sentry           | Exceptions, performance monitoring |
| Profiling      | Sentry Profiling | CPU profiling (10% sampling)       |
| Analytics      | PostHog          | Product analytics, feature flags   |
| Logging        | Vercel Logs      | Application logs                   |
| Uptime         | Vercel           | Health checks                      |

## Deployment Architecture

```mermaid
flowchart TB
    subgraph Dev["Development"]
        Local["Local Dev<br/>(pnpm dev)"]
        Preview["Vercel Preview<br/>(PR branches)"]
    end

    subgraph Staging["Staging"]
        Stage_App["Staging App"]
        Stage_DB["Staging Supabase<br/>(nabatable-pre-staging)"]
    end

    subgraph Prod["Production"]
        Prod_App["Production App<br/>(Vercel)"]
        Prod_DB["Production Supabase<br/>(nabatable)"]
    end

    Local --> Preview
    Preview --> Stage_App
    Stage_App --> Stage_DB
    Stage_App -->|Promote| Prod_App
    Prod_App --> Prod_DB
```

## External Integrations

| Service  | Purpose                   | Environment Variables                                            |
| -------- | ------------------------- | ---------------------------------------------------------------- |
| Supabase | Database, Auth, Realtime  | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| Sentry   | Error tracking, profiling | `SENTRY_DSN`, `SENTRY_AUTH_TOKEN`                                |
| Resend   | Transactional email       | `RESEND_API_KEY`                                                 |
| PostHog  | Product analytics         | `NEXT_PUBLIC_POSTHOG_KEY`                                        |
| Vercel   | Hosting, Edge, CI/CD      | Automatic via platform                                           |

## Related Documentation

- [Routing Overview](./routing-overview.md)
- [Authentication Routes](./authentication-routes.md)
- [Database Migrations](./DATABASE_MIGRATIONS.md)
- [Rollout Strategy](./rollout-strategy.md)
- [Rollback Runbook](./runbooks/rollback.md)

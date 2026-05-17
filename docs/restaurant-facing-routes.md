# Restaurant-Facing Routes (Ops App)

## Domain Architecture

**Single main domain:** `nabatable.com`
**Restaurant-facing subdomain:** `app.nabatable.com`

### Routing Rules

1. **Restaurant-facing routes** are accessible via:
   - `nabatable.com/app/<route>` (vanity URL - redirects to subdomain)
   - `app.nabatable.com/<route>` (canonical URL)

2. **Guest-facing routes** live directly under:
   - `nabatable.com/<route>` (no `/app` prefix)
   - Examples: `nabatable.com/restaurants`, `nabatable.com/bookings/123`

3. **Separation:**
   - Everything under `/app` prefix (or on `app.nabatable.com`) = restaurant-facing
   - Everything else on main domain = guest-facing

### Routing Examples

| From Main Domain             | Redirects To                 | Description                   |
| ---------------------------- | ---------------------------- | ----------------------------- |
| `nabatable.com/app/walk-in`  | `app.nabatable.com/walk-in`  | 308 redirect                  |
| `nabatable.com/app/bookings` | `app.nabatable.com/bookings` | 308 redirect                  |
| `nabatable.com/app/settings` | `app.nabatable.com/settings` | 308 redirect                  |
| `nabatable.com/app`          | `app.nabatable.com/`         | 308 redirect                  |
| `nabatable.com/login`        | `nabatable.com/auth`         | Internal redirect to Auth Hub |

Note: In preview/single-host mode (`VERCEL_ENV=preview` or host in `NEXT_PUBLIC_LOCAL_APP_HOSTS`), `/app/*` stays on the same host.

| On App Subdomain                | Internal Rewrite            | Description                     |
| ------------------------------- | --------------------------- | ------------------------------- |
| `app.nabatable.com/walk-in`     | `/app/walk-in`              | Rewrite for Next.js routing     |
| `app.nabatable.com/bookings`    | `/app/bookings`             | Rewrite for Next.js routing     |
| `app.nabatable.com/app/walk-in` | `app.nabatable.com/walk-in` | 308 redirect (remove duplicate) |

## Authentication Flow

Unauthenticated users attempting to access protected routes are redirected to the **Auth Hub** at `/auth`.

1. **Owner Routes (`/app/*` or `app.*`):** Redirected to `/auth?redirectedFrom=<path>`
2. **Protected Guest Routes:** Redirected to `/auth?redirectedFrom=<path>`
3. **Auth Hub (`/auth`):** Allows user to choose their role (Guest or Owner).
   - Choosing **Guest** leads to `/auth/signin`
   - Choosing **Owner** leads to `app.nabatable.com/auth/signin` (or `/app/auth/signin` on local)

The `redirectedFrom` parameter is preserved throughout the flow to ensure users return to their intended destination after successful sign-in.

## Restaurant-Facing UI Routes

All routes are accessible at `app.nabatable.com/<route>`:

### Core Pages

- `/` — Dashboard home
- `/auth` — Role selection and login
- `/dashboard` — Dashboard overview

### Bookings & Walk-ins

- `/bookings` — Bookings management
- `/walk-in` — Walk-in customer management

### Customer Management

- `/customers` — Customer database

### Analytics

- `/analytics` — Analytics overview
- `/analytics/rejections` — Rejection analytics

### Seating Management

- `/seating` — Seating overview
- `/seating/capacity` — Capacity management
- `/seating/floor-plan` — Floor plan editor

### Team Management

- `/management` — Management overview
- `/management/team` — Team management

### Settings

- `/settings` — Settings overview
- `/settings/restaurant` — Redirect to restaurant profile
- `/settings/restaurant/profile` — Restaurant profile
- `/settings/restaurant/operating-hours` — Operating hours
- `/settings/restaurant/service-periods` — Service periods
- `/settings/restaurant/turn-durations` — Reservation durations
- `/settings/restaurant/occasions` — Special occasions
- `/settings/restaurant/team` — Team settings
- `/settings/tables` — Table configuration

## Restaurant-Facing API Routes

API routes on `app.nabatable.com` are automatically rewritten from `/api/<service>` to `/api/ops/<service>`.

### Ops Services (Auto-rewritten)

- `allowed-capacities`
- `bookings`
- `customers`
- `dashboard`
- `occasions`
- `restaurants`
- `settings`
- `strategies`
- `tables`
- `team`
- `zones`

### API Examples

| Request                           | Rewritten To         | Description    |
| --------------------------------- | -------------------- | -------------- |
| `app.nabatable.com/api/bookings`  | `/api/ops/bookings`  | List bookings  |
| `app.nabatable.com/api/customers` | `/api/ops/customers` | List customers |
| `app.nabatable.com/api/tables`    | `/api/ops/tables`    | List tables    |

## Entry Flow Diagram

```mermaid
flowchart TD
    subgraph MainDomain [nabatable.com]
        A[/*] -->|Unauthenticated| B[/auth Hub]
        A -->|Guest Route| C[Guest Pages]
        A -->|/app/*| D[Redirect to Subdomain]
    end

    subgraph AppSubdomain [app.nabatable.com]
        E[/*] -->|Unauthenticated| B
        E -->|Authenticated| F[Ops Pages]
    end

    B --> G{Choose Role}
    G -->|Guest| H[/auth/signin]
    G -->|Owner| I[app.nabatable.com/auth/signin]

    H --> J[/guest/dashboard]
    I --> F
```

## Implementation Notes

**Proxy Logic (src/proxy.ts):**

1. On `nabatable.com`: `/app/*` → 308 redirect → `app.nabatable.com/*`
2. On `app.nabatable.com`: `/*` → internal rewrite → `/app/*` (for Next.js routing)
3. API rewrites: `/api/<service>` → `/api/ops/<service>` (for configured ops services)

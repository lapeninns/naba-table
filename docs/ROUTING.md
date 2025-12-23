# Routing Architecture

> SajiloReserveX dual-facing application routing documentation

## Overview

This application serves **two distinct user types** with separate routing contexts:

| Context               | Subdomain                          | URL Prefix | Users                         |
| --------------------- | ---------------------------------- | ---------- | ----------------------------- |
| **Guest-facing**      | `localhost` / `domain.com`         | `/guest/*` | Customers making reservations |
| **Restaurant-facing** | `app.localhost` / `app.domain.com` | `/app/*`   | Restaurant operators/staff    |

---

## File System Structure

```
src/app/
├── (public)/                    # PUBLIC (no auth required)
│   ├── page.tsx                 # Homepage (/)
│   ├── auth/signin/             # Guest sign-in page
│   ├── bookings/                # Public booking flow
│   │   ├── [bookingId]/         # View booking
│   │   ├── [bookingId]/manage/  # Manage booking
│   │   └── [bookingId]/thank-you/
│   └── (marketing)/             # Marketing pages (contact, about, etc.)
│
├── guest/                       # PROTECTED GUEST PAGES (auth required)
│   ├── page.tsx                 # Guest home (redirects to dashboard)
│   ├── dashboard/               # Guest dashboard
│   ├── bookings/                # Guest's booking history
│   │   └── [bookingId]/         # Booking details
│   ├── profile/                 # Guest profile settings
│   └── thank-you/               # Post-booking confirmation
│
├── app/                         # RESTAURANT-FACING PAGES
│   ├── auth/signin/             # Restaurant operator sign-in
│   └── (app)/                   # PROTECTED RESTAURANT PAGES (auth required)
│       ├── dashboard/           # Operator dashboard
│       ├── bookings/            # Manage bookings
│       ├── customers/           # Customer management
│       ├── new-bookings/        # Create bookings
│       ├── settings/            # Restaurant settings
│       │   ├── restaurant/      # Profile, hours, occasions
│       │   └── tables/          # Table management
│       └── management/team/     # Team management
│
└── api/                         # API ROUTES
    ├── auth/                    # SHARED - Auth APIs (signin, signout, callback)
    ├── bookings/                # Guest booking APIs (create, read, update)
    ├── profile/                 # Guest profile APIs
    ├── availability/            # Public - Check availability
    ├── restaurants/             # Public - Restaurant info, schedule
    ├── v1/                      # Versioned APIs (events, etc.)
    └── ops/                     # PROTECTED - Restaurant operator APIs
        ├── bookings/            # Ops booking management
        ├── customers/           # Ops customer management
        ├── dashboard/           # Ops dashboard data
        ├── tables/              # Ops table management
        ├── zones/               # Ops zone management
        ├── restaurants/         # Ops restaurant settings
        ├── team/                # Ops team management
        └── settings/            # Ops configuration
```

---

## Routing Rules (proxy.ts)

### On Restaurant Subdomain (`app.localhost` / `app.domain.com`)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    REQUEST TO app.localhost:3000                    │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Is /guest/* ?                                                       │
│   → REDIRECT to localhost:3000/guest/*                              │
└─────────────────────────────────────────────────────────────────────┘
                                  │ No
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Is /app/* ?                                                         │
│   → Strip /app prefix and redirect (avoid /app/app/...)             │
└─────────────────────────────────────────────────────────────────────┘
                                  │ No
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Is /api/* ?                                                         │
├─────────────────────────────────────────────────────────────────────┤
│ • /api/bookings, /api/customers, etc. (OPS_API_SERVICES)           │
│   → REWRITE to /api/ops/* + require ops auth                       │
│ • /api/ops/* directly                                               │
│   → PASS THROUGH + require ops auth                                │
│ • /api/auth/*, /api/profile/*, /api/restaurants/*, /api/v1/*       │
│   → PASS THROUGH (shared APIs, no rewrite)                         │
└─────────────────────────────────────────────────────────────────────┘
                                  │ No (it's a page route)
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Is / (root)?                                                        │
│   → REDIRECT to /dashboard                                          │
└─────────────────────────────────────────────────────────────────────┘
                                  │ No
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Is /auth/* ?                                                        │
│   → REWRITE to /app/auth/* (restaurant auth pages)                  │
└─────────────────────────────────────────────────────────────────────┘
                                  │ No
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ All other page routes (/dashboard, /bookings, /customers, etc.)     │
│   → REWRITE to /app/* + CHECK AUTH                                 │
│   → If not authenticated → REDIRECT to /auth/signin                 │
└─────────────────────────────────────────────────────────────────────┘
```

### On Guest Domain (`localhost` / `domain.com`)

```
┌─────────────────────────────────────────────────────────────────────┐
│                     REQUEST TO localhost:3000                       │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Is /api/ops/* ?                                                     │
│   → PASS THROUGH + require ops auth                                │
└─────────────────────────────────────────────────────────────────────┘
                                  │ No
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Is /app/* ?                                                         │
│   → Single-host mode: PASS THROUGH                                  │
│   → Multi-host mode: REDIRECT to app.domain.com/app/*               │
└─────────────────────────────────────────────────────────────────────┘
                                  │ No
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ All other routes                                                    │
│   → PASS THROUGH                                                    │
│   (handled by Next.js file-based routing)                           │
└─────────────────────────────────────────────────────────────────────┘
```

---

## API Route Categories

### Shared APIs (accessible from both contexts)

- `/api/auth/*` - Authentication (signin, signout, callback, e2e-login)
- `/api/profile/*` - User profile management
- `/api/restaurants/*` - Public restaurant info, schedule, calendar-mask
- `/api/availability` - Check table availability
- `/api/bookings/*` - Guest booking operations
- `/api/v1/*` - Versioned external APIs

### Guest-Only APIs

- `/api/lead` - Lead capture
- `/api/reservations/*` - Reservation confirmations

### Restaurant-Only APIs (require ops auth)

- `/api/ops/bookings/*` - Operator booking management
- `/api/ops/customers/*` - Customer database
- `/api/ops/dashboard/*` - Dashboard metrics
- `/api/ops/tables/*` - Table management
- `/api/ops/zones/*` - Zone management
- `/api/ops/restaurants/*` - Restaurant settings
- `/api/ops/team/*` - Team/staff management
- `/api/ops/occasions/*` - Special occasions
- `/api/ops/settings/*` - Configuration
- `/api/ops/strategies/*` - Booking strategies

---

## Authentication Flow

### Guest Authentication

1. Guest visits `/guest/dashboard` (protected)
2. Middleware checks for authenticated session
3. If not authenticated → redirect to `/auth/signin`
4. After login → redirect back to original URL

### Restaurant Operator Authentication

1. Operator visits `app.localhost:3000/dashboard`
2. Proxy rewrites to `/app/dashboard`
3. Middleware checks for authenticated session
4. If not authenticated → redirect to `/auth/signin` (on app subdomain)
5. After login → redirect back to original URL

---

## Local Development

```bash
# Guest-facing (public site)
http://localhost:3000/                    # Homepage
http://localhost:3000/guest/dashboard     # Guest dashboard (auth required)
http://localhost:3000/bookings            # Public booking page

# Restaurant-facing (operator site)
http://app.localhost:3000/                # Redirects to /dashboard
http://app.localhost:3000/dashboard       # Operator dashboard (auth required)
http://app.localhost:3000/bookings        # Manage bookings (auth required)
```

---

## Production (Multi-Host Mode)

```bash
# Guest-facing
https://sajiloreserve.com/                # Homepage
https://sajiloreserve.com/guest/*         # Guest portal

# Restaurant-facing
https://app.sajiloreserve.com/            # Operator portal
https://app.sajiloreserve.com/dashboard   # Operator dashboard
```

---

## Key Environment Variables

| Variable                      | Description                                   | Example                                |
| ----------------------------- | --------------------------------------------- | -------------------------------------- |
| `NEXT_PUBLIC_ROOT_DOMAIN`     | Root domain for routing logic                 | `localhost` or `sajiloreserve.com`     |
| `NEXT_PUBLIC_LOCAL_APP_HOSTS` | Additional hosts to treat as single-host mode | `127.0.0.1,192.168.1.100`              |
| `VERCEL_ENV`                  | Vercel deployment environment                 | `production`, `preview`, `development` |

---

## Troubleshooting

### 404 on API routes from app subdomain

**Cause**: API route being incorrectly rewritten to `/app/api/*`
**Fix**: Ensure the route is handled before the page rewrite logic in proxy.ts

### Auth redirect loops

**Cause**: Auth pages being treated as protected pages
**Fix**: Ensure `/auth/*` paths skip the auth check in proxy.ts

### /guest/\* showing on app subdomain

**Cause**: Missing redirect for guest routes on app subdomain
**Fix**: Check the guest route redirect at the top of the isApp block

# Comprehensive Repository Route Analysis

## SajiloReserveX - Complete Flow Documentation

**Generated**: 2025-01-15  
**Repository**: SajiloReserveX  
**Framework**: Next.js 15.5.4 (App Router)

---

## Table of Contents

1. [Repository Overview](#1-repository-overview)
2. [Route Discovery & Cataloging](#2-route-discovery--cataloging)
3. [Route Hierarchy & Organization](#3-route-hierarchy--organization)
4. [Authentication & Authorization Flow](#4-authentication--authorization-flow)
5. [Middleware Pipeline](#5-middleware-pipeline)
6. [Request/Response Flow](#6-requestresponse-flow)
7. [Data Flow & Dependencies](#7-data-flow--dependencies)
8. [Database Operations](#8-database-operations)
9. [Business Logic Mapping](#9-business-logic-mapping)
10. [Route Dependencies & Relationships](#10-route-dependencies--relationships)
11. [Edge Cases & Special Routes](#11-edge-cases--special-routes)
12. [Security Analysis](#12-security-analysis)
13. [Performance Considerations](#13-performance-considerations)
14. [External Integrations](#14-external-integrations)
15. [Visual Representations](#15-visual-representations)
16. [API Documentation](#16-api-documentation)
17. [Summary & Quick Reference](#17-summary--quick-reference)

---

## 1. Repository Overview

### Framework & Architecture

- **Framework**: Next.js 15.5.4 with App Router (React 19.2.0)
- **Language**: TypeScript 5.9.2
- **Architecture Pattern**: Feature-based monolithic with modular route groups
- **Package Manager**: pnpm 9.0.0+
- **Node Version**: 20.11.0+

### Main Directories Structure

```
/Users/amankumarshrestha/Downloads/SajiloReserveX/
├── src/
│   ├── app/                    # Next.js App Router pages & API routes
│   │   ├── (authed)/          # Authenticated routes group
│   │   ├── (customer)/        # Customer-facing routes group
│   │   ├── (ops)/             # Operations console routes group
│   │   └── api/               # API route handlers
│   ├── components/            # React components
│   ├── contexts/              # React contexts
│   ├── hooks/                 # Custom React hooks
│   ├── services/              # Service layer
│   ├── types/                 # TypeScript type definitions
│   └── utils/                 # Utility functions
├── server/                    # Server-side utilities & logic
│   ├── auth/                  # Authentication utilities
│   ├── bookings/              # Booking business logic
│   ├── restaurants/           # Restaurant operations
│   ├── security/              # Security utilities (rate limiting, etc.)
│   ├── team/                  # Team management
│   └── supabase.ts           # Supabase client configuration
├── lib/                       # Shared library code
├── components/                # Shared UI components
├── hooks/                     # Shared hooks
├── types/                     # Global type definitions
├── tests/                     # Test files
│   └── e2e/                  # End-to-end tests
├── middleware.ts              # Next.js middleware
├── config.ts                  # App configuration
└── next.config.js            # Next.js configuration
```

### Entry Points

1. **Application Entry**: `src/app/layout.tsx` - Root layout with providers
2. **Middleware**: `middleware.ts` - Request interception for auth & API versioning
3. **API Entry**: `src/app/api/**` - REST API endpoints

### Configuration Files Affecting Routing

#### `next.config.js`

- **Path Aliases**: Extensive webpack aliases for clean imports
  - `@/app`, `@/components`, `@/lib`, `@/server`, `@/types`, etc.
- **Image Domains**: Whitelisted domains for Next.js Image component
- **ESLint**: Configured for app/reserve directories

#### `middleware.ts`

- **Protected Routes**: `/my-bookings/*`, `/profile/*`, `/thank-you/*`
- **API Versioning**: Adds deprecation headers to unversioned API routes
- **Authentication**: Supabase session refresh and auth gating

#### `config.ts`

- **App Name**: "ShipFast" (template base)
- **Domain**: shipfa.st
- **Auth Paths**:
  - Login: `/signin`
  - Callback: `/` (root)
- **Email Config**: Mailgun integration configured
- **Crisp**: Customer support chat (conditional rendering)

---

## 2. Route Discovery & Cataloging

### Total Route Count

- **Page Routes**: 28 files
- **API Routes**: 49 files
- **Total Routes**: 77

### All Routes Catalog

#### A. Page Routes (Customer-Facing)

##### Public Pages (No Authentication Required)

| Route                         | File Location                                 | Purpose                             |
| ----------------------------- | --------------------------------------------- | ----------------------------------- |
| `/`                           | `src/app/page.tsx`                            | Homepage/Landing page               |
| `/browse`                     | `src/app/browse/page.tsx`                     | Browse restaurants                  |
| `/create`                     | `src/app/create/page.tsx`                     | Create booking CTA page             |
| `/checkout`                   | `src/app/checkout/page.tsx`                   | Checkout flow                       |
| `/signin`                     | `src/app/signin/page.tsx`                     | Authentication page                 |
| `/blog`                       | `src/app/blog/page.tsx`                       | Blog listing                        |
| `/blog/[articleId]`           | `src/app/blog/[articleId]/page.tsx`           | Individual blog post                |
| `/blog/author/[authorId]`     | `src/app/blog/author/[authorId]/page.tsx`     | Author profile                      |
| `/blog/category/[categoryId]` | `src/app/blog/category/[categoryId]/page.tsx` | Category archive                    |
| `/item/[slug]`                | `src/app/item/[slug]/page.tsx`                | Direct restaurant reservation entry |
| `/reserve`                    | `src/app/reserve/page.tsx`                    | Reservation search/landing          |
| `/reserve/[reservationId]`    | `src/app/reserve/[reservationId]/page.tsx`    | Reservation confirmation            |
| `/reserve/r/[slug]`           | `src/app/reserve/r/[slug]/page.tsx`           | Restaurant-specific reservation     |
| `/invite/[token]`             | `src/app/invite/[token]/page.tsx`             | Team invitation acceptance          |
| `/tos`                        | `src/app/tos/page.tsx`                        | Terms of service                    |
| `/privacy-policy`             | `src/app/privacy-policy/page.tsx`             | Privacy policy                      |
| `/terms/venue`                | `src/app/terms/venue/page.tsx`                | Venue-specific terms                |
| `/terms/togo`                 | `src/app/terms/togo/page.tsx`                 | To-go order terms                   |

##### Protected Pages (Authentication Required)

| Route             | File Location                              | Auth Level | Middleware Protected |
| ----------------- | ------------------------------------------ | ---------- | -------------------- |
| `/my-bookings`    | `src/app/(authed)/my-bookings/page.tsx`    | User       | ✅ Yes               |
| `/profile/manage` | `src/app/(authed)/profile/manage/page.tsx` | User       | ✅ Yes               |
| `/thank-you`      | `src/app/thank-you/page.tsx`               | User       | ✅ Yes               |

##### Ops Console Routes (Staff/Admin)

| Route                      | File Location                                          | Auth Level | Route Group |
| -------------------------- | ------------------------------------------------------ | ---------- | ----------- |
| `/ops`                     | `src/app/(ops)/ops/(app)/page.tsx`                     | Staff      | (ops)       |
| `/ops/login`               | `src/app/(ops)/ops/(public)/login/page.tsx`            | Public     | (ops)       |
| `/ops/bookings`            | `src/app/(ops)/ops/(app)/bookings/page.tsx`            | Staff      | (ops)       |
| `/ops/bookings/new`        | `src/app/(ops)/ops/(app)/bookings/new/page.tsx`        | Staff      | (ops)       |
| `/ops/customer-details`    | `src/app/(ops)/ops/(app)/customer-details/page.tsx`    | Staff      | (ops)       |
| `/ops/team`                | `src/app/(ops)/ops/(app)/team/page.tsx`                | Staff      | (ops)       |
| `/ops/restaurant-settings` | `src/app/(ops)/ops/(app)/restaurant-settings/page.tsx` | Staff      | (ops)       |

#### B. API Routes

##### Unversioned API Routes (Deprecated - with Sunset headers)

**Authentication**
| Method | Route | File | Purpose |
|--------|-------|------|---------|
| GET | `/api/auth/callback` | `src/app/api/auth/callback/route.ts` | OAuth callback handler |

**Bookings**
| Method | Route | File | Purpose |
|--------|-------|------|---------|
| GET, POST | `/api/bookings` | `src/app/api/bookings/route.ts` | List authenticated bookings / create booking (rate limited) |
| GET | `/api/bookings/confirm` | `src/app/api/bookings/confirm/route.ts` | Token-based confirmation fetch |
| GET | `/api/bookings/[id]` | `src/app/api/bookings/[id]/route.ts` | Get booking details (owner only) |
| GET | `/api/bookings/[id]/history` | `src/app/api/bookings/[id]/history/route.ts` | Booking audit history (owner only) |

**Events**
| Method | Route | File | Purpose |
|--------|-------|------|---------|
| POST | `/api/events` | `src/app/api/events/route.ts` | Analytics/tracking events |

**Lead Generation**
| Method | Route | File | Purpose |
|--------|-------|------|---------|
| POST | `/api/lead` | `src/app/api/lead/route.ts` | Capture email leads |

**Restaurants**
| Method | Route | File | Purpose |
|--------|-------|------|---------|
| GET | `/api/restaurants` | `src/app/api/restaurants/route.ts` | List restaurants (⚠️ deprecated → v1) |
| GET | `/api/restaurants/[slug]/schedule` | `src/app/api/restaurants/[slug]/schedule/route.ts` | Get restaurant schedule (⚠️ deprecated → v1) |

**Profile**
| Method | Route | File | Purpose |
|--------|-------|------|---------|
| GET, PUT | `/api/profile` | `src/app/api/profile/route.ts` | Get/update user profile |
| POST | `/api/profile/image` | `src/app/api/profile/image/route.ts` | Upload profile image |

**Team Management**
| Method | Route | File | Purpose |
|--------|-------|------|---------|
| GET | `/api/team/invitations/[token]` | `src/app/api/team/invitations/[token]/route.ts` | Get invitation details |
| POST | `/api/team/invitations/[token]/accept` | `src/app/api/team/invitations/[token]/accept/route.ts` | Accept team invitation |

**Ops Console API**
| Method | Route | File | Purpose |
|--------|-------|------|---------|
| GET, POST | `/api/ops/bookings` | `src/app/api/ops/bookings/route.ts` | Ops booking management |
| GET | `/api/ops/bookings/[id]` | `src/app/api/ops/bookings/[id]/route.ts` | Ops booking details |
| PUT | `/api/ops/bookings/[id]/status` | `src/app/api/ops/bookings/[id]/status/route.ts` | Update booking status |
| GET | `/api/ops/bookings/export` | `src/app/api/ops/bookings/export/route.ts` | Export bookings CSV |
| GET | `/api/ops/customers` | `src/app/api/ops/customers/route.ts` | Customer management |
| GET | `/api/ops/customers/export` | `src/app/api/ops/customers/export/route.ts` | Export customers CSV |
| GET | `/api/ops/restaurants` | `src/app/api/ops/restaurants/route.ts` | Restaurant list for ops |
| GET | `/api/ops/restaurants/[id]` | `src/app/api/ops/restaurants/[id]/route.ts` | Restaurant details |
| GET | `/api/ops/dashboard/summary` | `src/app/api/ops/dashboard/summary/route.ts` | Dashboard summary stats |
| GET | `/api/ops/dashboard/heatmap` | `src/app/api/ops/dashboard/heatmap/route.ts` | Booking heatmap data |
| GET | `/api/ops/dashboard/capacity` | `src/app/api/ops/dashboard/capacity/route.ts` | Capacity utilization |
| GET | `/api/ops/dashboard/vips` | `src/app/api/ops/dashboard/vips/route.ts` | VIP customer list |
| GET | `/api/ops/dashboard/changes` | `src/app/api/ops/dashboard/changes/route.ts` | Recent changes feed |

**Owner/Restaurant Admin API**
| Method | Route | File | Purpose |
|--------|-------|------|---------|
| GET, POST | `/api/owner/team/invitations` | `src/app/api/owner/team/invitations/route.ts` | Team invitations |
| DELETE | `/api/owner/team/invitations/[inviteId]` | `src/app/api/owner/team/invitations/[inviteId]/route.ts` | Cancel invitation |
| GET, POST | `/api/owner/team/memberships` | `src/app/api/owner/team/memberships/route.ts` | Team memberships |
| PUT | `/api/owner/restaurants/[id]/details` | `src/app/api/owner/restaurants/[id]/details/route.ts` | Update restaurant details |
| GET, PUT | `/api/owner/restaurants/[id]/hours` | `src/app/api/owner/restaurants/[id]/hours/route.ts` | Operating hours |
| GET, POST | `/api/owner/restaurants/[id]/service-periods` | `src/app/api/owner/restaurants/[id]/service-periods/route.ts` | Service period config |

**Testing/Dev Routes**
| Method | Route | File | Purpose |
|--------|-------|------|---------|
| POST | `/api/test-email` | `src/app/api/test-email/route.ts` | Email testing endpoint |
| POST | `/api/test/invitations` | `src/app/api/test/invitations/route.ts` | Test data: invitations |
| POST | `/api/test/leads` | `src/app/api/test/leads/route.ts` | Test data: leads |
| POST | `/api/test/bookings` | `src/app/api/test/bookings/route.ts` | Test data: bookings |
| POST | `/api/test/playwright-session` | `src/app/api/test/playwright-session/route.ts` | E2E test auth |
| GET | `/api/test/reservations/[reservationId]/confirmation` | `src/app/api/test/reservations/[reservationId]/confirmation/route.ts` | Test confirmation |

##### Versioned API Routes (v1 - Current)

**Note**: The `/api/v1/*` routes re-export the unversioned routes. Example:

```typescript
// src/app/api/v1/bookings/route.ts
export { GET, POST } from '../../bookings/route';
```

| Method    | Route                                                    | Maps To                                               |
| --------- | -------------------------------------------------------- | ----------------------------------------------------- |
| GET, POST | `/api/v1/bookings`                                       | `/api/bookings`                                       |
| GET       | `/api/v1/restaurants`                                    | `/api/restaurants`                                    |
| GET       | `/api/v1/restaurants/[slug]/schedule`                    | `/api/restaurants/[slug]/schedule`                    |
| GET, PUT  | `/api/v1/profile`                                        | `/api/profile`                                        |
| POST      | `/api/v1/profile/image`                                  | `/api/profile/image`                                  |
| POST      | `/api/v1/events`                                         | `/api/events`                                         |
| POST      | `/api/v1/lead`                                           | `/api/lead`                                           |
| POST      | `/api/v1/test/leads`                                     | `/api/test/leads`                                     |
| POST      | `/api/v1/test/bookings`                                  | `/api/test/bookings`                                  |
| POST      | `/api/v1/test/playwright-session`                        | `/api/test/playwright-session`                        |
| GET       | `/api/v1/test/reservations/[reservationId]/confirmation` | `/api/test/reservations/[reservationId]/confirmation` |

---

## 3. Route Hierarchy & Organization

### Visual Route Tree

```
/ (root)
├── 🌐 Public Routes
│   ├── / (homepage)
│   ├── /browse (restaurant directory)
│   ├── /create (booking CTA)
│   ├── /checkout (payment flow)
│   ├── /signin (authentication)
│   ├── /reserve
│   │   ├── / (reservation landing)
│   │   ├── /[reservationId] (confirmation)
│   │   └── /r/[slug] (restaurant-specific)
│   ├── /item/[slug] (direct booking entry)
│   ├── /invite/[token] (team invitations)
│   ├── /blog
│   │   ├── / (blog index)
│   │   ├── /[articleId] (post detail)
│   │   ├── /author/[authorId] (author page)
│   │   └── /category/[categoryId] (category archive)
│   ├── /tos (terms of service)
│   ├── /privacy-policy
│   └── /terms
│       ├── /venue
│       └── /togo
│
├── 🔒 Protected Routes (authed)
│   ├── /my-bookings (user booking history)
│   ├── /profile/manage (user profile)
│   └── /thank-you (post-booking)
│
├── 🏢 Ops Console (staff/admin)
│   ├── /ops (dashboard)
│   ├── /ops/login (staff login)
│   ├── /ops/bookings (booking management)
│   ├── /ops/bookings/new (walk-in booking)
│   ├── /ops/customer-details (customer view)
│   ├── /ops/team (team management)
│   └── /ops/restaurant-settings (config)
│
└── 📡 API Routes
    ├── /api/auth
    │   └── /callback (OAuth callback)
    │
    ├── /api/bookings (⚠️ deprecated → /api/v1/bookings)
    │   ├── / [GET, POST]
    │   └── /[id]
    │       ├── / [GET]
    │       └── /history [GET]
    │
    ├── /api/restaurants (⚠️ deprecated → /api/v1/restaurants)
    │   ├── / [GET]
    │   └── /[slug]/schedule [GET]
    │
    ├── /api/profile (⚠️ deprecated → /api/v1/profile)
    │   ├── / [GET, PUT]
    │   └── /image [POST]
    │
    ├── /api/lead (⚠️ deprecated → /api/v1/lead)
    │   └── / [POST]
    │
    ├── /api/events (⚠️ deprecated → /api/v1/events)
    │   └── / [POST]
    │
    ├── /api/team
    │   └── /invitations/[token]
    │       ├── / [GET]
    │       └── /accept [POST]
    │
    ├── /api/ops (staff-only)
    │   ├── /bookings
    │   │   ├── / [GET, POST]
    │   │   ├── /[id] [GET]
    │   │   ├── /[id]/status [PUT]
    │   │   └── /export [GET]
    │   ├── /customers
    │   │   ├── / [GET]
    │   │   └── /export [GET]
    │   ├── /restaurants
    │   │   ├── / [GET]
    │   │   └── /[id] [GET]
    │   └── /dashboard
    │       ├── /summary [GET]
    │       ├── /heatmap [GET]
    │       ├── /capacity [GET]
    │       ├── /vips [GET]
    │       └── /changes [GET]
    │
    ├── /api/owner (restaurant owner)
    │   ├── /team
    │   │   ├── /invitations [GET, POST]
    │   │   ├── /invitations/[inviteId] [DELETE]
    │   │   └── /memberships [GET, POST]
    │   └── /restaurants/[id]
    │       ├── /details [PUT]
    │       ├── /hours [GET, PUT]
    │       └── /service-periods [GET, POST]
    │
    ├── /api/test (development only)
    │   ├── /invitations [POST]
    │   ├── /leads [POST]
    │   ├── /bookings [POST]
    │   ├── /playwright-session [POST]
    │   └── /reservations/[reservationId]/confirmation [GET]
    │
    ├── /api/test-email [POST]
    │
    └── /api/v1 (versioned - current)
        ├── /bookings [GET, POST]
        ├── /profile [GET, PUT]
        ├── /profile/image [POST]
        ├── /events [POST]
        ├── /lead [POST]
        └── /test
            ├── /leads [POST]
            ├── /bookings [POST]
            ├── /playwright-session [POST]
            └── /reservations/[reservationId]/confirmation [GET]
```

### Route Grouping Strategy

#### Route Groups (Next.js Feature)

Next.js route groups are directories wrapped in parentheses that don't affect the URL path:

1. **(authed)** - Authenticated user routes
   - Shared layout for logged-in users
   - Protected by middleware

2. **(customer)** - Customer-facing routes
   - May have customer-specific layouts
   - Contains (account) and (guest) subgroups

3. **(ops)** - Operations console
   - Contains (app) for authenticated staff routes
   - Contains (public) for staff login page
   - Separate layout for ops UI

### Route Prefixes

| Prefix          | Purpose                      | Authentication   | Example                       |
| --------------- | ---------------------------- | ---------------- | ----------------------------- |
| `/`             | Public pages                 | Optional         | `/`, `/browse`                |
| `/api/`         | Unversioned API (deprecated) | Varies           | `/api/bookings`               |
| `/api/v1/`      | Versioned API                | Varies           | `/api/v1/bookings`            |
| `/api/ops/`     | Staff operations API         | Required (staff) | `/api/ops/bookings`           |
| `/api/owner/`   | Restaurant owner API         | Required (owner) | `/api/owner/restaurants/[id]` |
| `/api/test/`    | Testing endpoints            | Development only | `/api/test/bookings`          |
| `/ops/`         | Staff console pages          | Required (staff) | `/ops/bookings`               |
| `/my-bookings/` | User bookings                | Required (user)  | `/my-bookings`                |
| `/profile/`     | User profile                 | Required (user)  | `/profile/manage`             |

---

## 4. Authentication & Authorization Flow

### Authentication System

- **Provider**: Supabase Auth
- **Method**: Magic links (passwordless email authentication)
- **Session Storage**: HTTP-only cookies managed by Supabase SSR

### Supabase Client Types

```typescript
// 1. Service Client - Full database access (service role key)
getServiceSupabaseClient(): SupabaseClient
// Use: Server-side operations, bypasses RLS

// 2. Route Handler Client - User session (anon key + cookies)
getRouteHandlerSupabaseClient(): SupabaseClient
// Use: API routes with user context

// 3. Server Component Client - User session (anon key + cookies)
getServerComponentSupabaseClient(): SupabaseClient
// Use: Server components with user context

// 4. Middleware Client - User session (anon key + cookies)
getMiddlewareSupabaseClient(req, res): SupabaseClient
// Use: Middleware auth checks
```

### Authentication Flow Diagram

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ 1. Navigate to protected route
       │    (e.g., /my-bookings)
       ▼
┌──────────────────────┐
│    Middleware        │
│  (middleware.ts)     │
├──────────────────────┤
│ 1. Check if route    │
│    matches protected │
│    matchers          │
│ 2. getSession() via  │
│    Supabase          │
│ 3. If no session:    │
│    redirect to       │
│    /signin?redirect  │
│ 4. If session exists:│
│    allow request     │
└──────┬───────────────┘
       │ 2. Request proceeds
       ▼
┌──────────────────────┐
│  Page Component      │
│  or API Route        │
├──────────────────────┤
│ 1. getUser() if      │
│    needed            │
│ 2. Render/respond    │
└──────────────────────┘
```

### Protected Route Patterns

Defined in `middleware.ts`:

```typescript
const PROTECTED_MATCHERS = [/^\/my-bookings(\/.*)?$/, /^\/profile(\/.*)?$/, /^\/thank-you(\/.*)?$/];
```

### Middleware Configuration

```typescript
export const config = {
  matcher: [
    '/api/:path*', // All API routes (for versioning headers)
    '/my-bookings/:path*', // Protected route
    '/profile/:path*', // Protected route
    '/thank-you/:path*', // Protected route
  ],
};
```

### Authorization Levels

#### 1. Public (No Auth Required)

- Homepage, browse, blog
- Restaurant search and schedule viewing
- Lead capture

#### 2. Authenticated User

- **Routes**: `/my-bookings`, `/profile`, `/thank-you`
- **Verification**: Supabase session cookie
- **API**: `/api/bookings?me=1`, `/api/profile`

#### 3. Staff (Ops Console)

- **Routes**: `/ops/*` (except `/ops/login`)
- **Verification**: Team membership check via `fetchUserMemberships()`
- **API**: `/api/ops/*`
- **Permission Check**: `requireMembershipForRestaurant({ userId, restaurantId })`

#### 4. Restaurant Owner

- **API**: `/api/owner/*`
- **Verification**: Ownership check (not fully visible in provided code)
- **Permissions**: Manage team, update restaurant details, configure hours

### Permission Validation Example

From `/api/ops/bookings/route.ts`:

```typescript
export async function POST(req: NextRequest) {
  const supabase = await getRouteHandlerSupabaseClient();

  // 1. Get authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  // 2. Verify staff membership
  try {
    await requireMembershipForRestaurant({
      userId: user.id,
      restaurantId: payload.restaurantId,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 3. Proceed with operation
  // ...
}
```

### OAuth Callback Flow

**Route**: `GET /api/auth/callback`

```
User clicks magic link email
         ↓
Redirects to /api/auth/callback?code=XXX&redirectedFrom=/my-bookings
         ↓
Middleware intercepts (matched by /api/:path*)
         ↓
Route handler:
  1. Extract 'code' from query
  2. supabase.auth.exchangeCodeForSession(code)
  3. Session stored in HTTP-only cookie
  4. Redirect to 'redirectedFrom' or fallback to '/'
         ↓
User now authenticated, accessing /my-bookings
```

---

## 5. Middleware Pipeline

### Middleware Execution Order

```
Request
   ↓
┌──────────────────────────────────────────────┐
│ 1. Next.js Middleware (middleware.ts)        │
│    Order of operations:                      │
│    ├─ A. API Versioning (for /api/* routes) │
│    ├─ B. Auth Check (protected routes)      │
│    └─ C. Response modification               │
└──────────────────────────────────────────────┘
   ↓
┌──────────────────────────────────────────────┐
│ 2. Route Handler / Page Component           │
│    ├─ Rate Limiting (in API routes)         │
│    ├─ Request Validation (Zod schemas)      │
│    ├─ Business Logic                        │
│    └─ Response Generation                   │
└──────────────────────────────────────────────┘
   ↓
Response
```

### Middleware Details

#### A. API Versioning Deprecation Headers

For all `/api/*` routes that are NOT versioned (`/api/v1/*`):

```typescript
if (pathname.startsWith('/api/')) {
  const isVersioned = /^\/api\/v\d+\//.test(pathname);
  const response = NextResponse.next();

  if (!isVersioned) {
    const days = env.testing.routeCompatWindowDays ?? 30;
    const sunset = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    const successor = pathname.replace(/^\/api\//, '/api/v1/');

    response.headers.set('Deprecation', 'true');
    response.headers.set('Sunset', sunset);
    response.headers.set('Link', `<${successor}>; rel="successor-version"`);
  }

  return response;
}
```

**Headers Added**:

- `Deprecation: true`
- `Sunset: <ISO-8601 timestamp>` (30 days from now)
- `Link: </api/v1/path>; rel="successor-version"`

#### B. Authentication Gate

For protected routes (`/my-bookings`, `/profile`, `/thank-you`):

```typescript
const supabase = getMiddlewareSupabaseClient(req, response);
const {
  data: { session },
} = await supabase.auth.getSession();

if (!session && PROTECTED_MATCHERS.some((matcher) => matcher.test(pathname))) {
  const redirectUrl = req.nextUrl.clone();
  const loginPath = appConfig.auth?.loginUrl ?? '/signin';
  redirectUrl.pathname = loginPath;
  redirectUrl.searchParams.set('redirectedFrom', pathname);

  return NextResponse.redirect(redirectUrl);
}
```

**Flow**:

1. Extract Supabase session from cookies
2. If no session and route is protected → redirect to `/signin?redirectedFrom=<original-path>`
3. If session exists or route is public → continue

### Route-Level Middleware (API Routes)

Each API route may implement:

#### 1. Rate Limiting

Implemented via `consumeRateLimit()` from `server/security/rate-limit.ts`:

```typescript
const rateResult = await consumeRateLimit({
  identifier: `ops:bookings:get:${user.id}`,
  limit: 120,
  windowMs: 60_000, // 1 minute
});

if (!rateResult.ok) {
  const retryAfterSeconds = Math.max(1, Math.ceil((rateResult.resetAt - Date.now()) / 1000));

  return NextResponse.json(
    { error: 'Too many requests', code: 'RATE_LIMITED' },
    {
      status: 429,
      headers: {
        'Retry-After': retryAfterSeconds.toString(),
      },
    },
  );
}
```

**Rate Limit Storage**:

- **Production**: Upstash Redis (distributed)
- **Development Fallback**: In-memory Map (single-instance)

**Rate Limit Configurations** (observed):

| Endpoint Pattern     | Limit | Window | Identifier                                    |
| -------------------- | ----- | ------ | --------------------------------------------- |
| Guest booking lookup | 20    | 60s    | `bookings:lookup:{restaurantId}:{clientIp}`   |
| Ops bookings list    | 120   | 60s    | `ops:bookings:get:{userId}`                   |
| Ops booking create   | 60    | 60s    | `ops:bookings:create:{userId}:{restaurantId}` |

#### 2. Request Validation (Zod)

All API routes use Zod schemas for input validation:

```typescript
const bookingSchema = z.object({
  restaurantId: z.string().uuid().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  party: z.number().int().min(1),
  bookingType: z.enum(['breakfast', 'lunch', 'dinner', 'drinks']),
  seating: z.enum(['indoor', 'outdoor', 'bar', 'any']),
  notes: z.string().max(500).optional().nullable(),
  name: z.string().min(2).max(120),
  email: z.string().email(),
  phone: z.string().min(7).max(50),
  marketingOptIn: z.coerce.boolean().optional().default(false),
});

const parsed = bookingSchema.safeParse(payload);
if (!parsed.success) {
  return NextResponse.json(
    { error: 'Invalid payload', details: parsed.error.flatten() },
    { status: 400 },
  );
}
```

#### 3. Idempotency Key Handling

Many mutation endpoints support idempotency:

```typescript
const idempotencyKey = normalizeIdempotencyKey(req.headers.get('Idempotency-Key'));

// Check for existing operation with same key
const { data: existing } = await supabase
  .from('bookings')
  .select('*')
  .eq('idempotency_key', idempotencyKey)
  .maybeSingle();

if (existing) {
  return NextResponse.json(
    { booking: existing, duplicate: true },
    { headers: { 'Idempotency-Key': idempotencyKey } },
  );
}

// Insert new record with idempotency_key
await supabase.from('bookings').insert({
  // ... booking data
  idempotency_key: idempotencyKey,
});
```

**Header**: `Idempotency-Key: <UUID or unique string>`

**Tables with Idempotency Support**:

- `bookings` (column: `idempotency_key`)
- `profile_update_requests` (column: `idempotency_key`)

#### 4. Error Handling Pattern

Consistent error response structure:

```typescript
function handleZodError(error: z.ZodError) {
  return NextResponse.json(
    {
      error: 'Invalid payload',
      details: error.flatten(),
    },
    { status: 400 },
  );
}

try {
  // ... operation
} catch (error: unknown) {
  const message = stringifyError(error);
  console.error('[bookings][POST]', message);

  return NextResponse.json({ error: message || 'Unable to create booking' }, { status: 500 });
}
```

---

## 6. Request/Response Flow

### Typical API Request Flow

```
Client
  ↓ HTTP Request
┌─────────────────────────────────────────────┐
│ Middleware (middleware.ts)                  │
│ • API versioning headers                    │
│ • Auth session refresh                      │
└─────────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────────┐
│ Route Handler (e.g., /api/bookings/route.ts)│
│                                             │
│ 1. Extract query/body parameters            │
│ 2. Validate with Zod schema                 │
│ 3. Rate limiting check                      │
│ 4. Authentication check (if required)       │
│ 5. Authorization check (if required)        │
│ 6. Idempotency check (for mutations)        │
└─────────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────────┐
│ Server Layer (server/*)                     │
│                                             │
│ 1. Business logic functions                 │
│ 2. Database queries (Supabase)              │
│ 3. External API calls                       │
│ 4. Side effect triggers (jobs, emails)      │
└─────────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────────┐
│ Database (Supabase PostgreSQL)              │
│ • Row Level Security (RLS) policies         │
│ • Triggers                                  │
│ • Constraints                               │
└─────────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────────┐
│ Response Generation                         │
│ • Transform data to DTO                     │
│ • Add headers (idempotency, rate limit)     │
│ • Return JSON                               │
└─────────────────────────────────────────────┘
  ↓ HTTP Response
Client
```

### Request/Response Schemas by Endpoint

#### POST /api/bookings (Create Booking)

**Request**:

```typescript
{
  restaurantId?: string,          // UUID, optional (defaults to default restaurant)
  date: string,                   // "YYYY-MM-DD"
  time: string,                   // "HH:MM" (24-hour)
  party: number,                  // Min: 1
  bookingType: "breakfast" | "lunch" | "dinner" | "drinks",
  seating: "indoor" | "outdoor" | "bar" | "any",
  notes?: string | null,          // Max 500 chars
  name: string,                   // Min 2, max 120 chars
  email: string,                  // Valid email
  phone: string,                  // Min 7, max 50 chars
  marketingOptIn?: boolean        // Default: false
}
```

**Headers**:

- `Idempotency-Key` (optional): UUID or unique string
- `User-Agent` (captured for audit)

**Response** (201 Created or 200 if duplicate):

```typescript
{
  booking: {
    id: string,
    restaurant_id: string,
    customer_id: string,
    booking_date: string,
    start_time: string,
    end_time: string,
    reference: string,            // Human-readable code (e.g., "AB1234")
    party_size: number,
    booking_type: string,
    seating_preference: string,
    status: "confirmed",
    customer_name: string,
    customer_email: string,
    customer_phone: string,
    notes: string | null,
    marketing_opt_in: boolean,
    source: "api",
    client_request_id: string,
    idempotency_key: string | null,
    loyalty_points_awarded: number,
    created_at: string,
    updated_at: string,
    details: object
  },
  loyaltyPointsAwarded: number,
  bookings: [/* array of customer's bookings */],
  clientRequestId: string,
  idempotencyKey: string | null,
  duplicate: boolean                // true if idempotency key matched
}
```

**Error Responses**:

- `400 Bad Request`: Invalid payload, operating hours violation
- `409 Conflict`: Duplicate request with different payload
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Database or unexpected error

#### GET /api/bookings (List Bookings)

**Query Parameters (Guest Lookup)**:

```typescript
?email=user@example.com
&phone=+1234567890
&restaurantId=<UUID>              // Optional
```

**Query Parameters (My Bookings - Authenticated)**:

```typescript
?me=1
&restaurantId=<UUID>              // Optional
&status=pending|confirmed|cancelled|active
&from=2025-01-01T00:00:00Z        // ISO-8601 with offset
&to=2025-12-31T23:59:59Z
&sort=asc|desc                    // Default: asc
&page=1                           // Default: 1
&pageSize=10                      // Default: 10, max: 50
```

**Response (Guest Lookup)**:

```typescript
{
  bookings: [
    {
      id: string,
      start_at: string,
      end_at: string,
      party_size: number,
      status: string,
      notes: string | null,
      restaurants: { name: string },
    },
  ];
}
```

**Response (My Bookings - Paginated)**:

```typescript
{
  items: [
    {
      id: string,
      restaurantName: string,
      partySize: number,
      startIso: string,
      endIso: string,
      status: string,
      notes: string | null,
      customerName: null,
      customerEmail: null
    }
  ],
  pageInfo: {
    page: number,
    pageSize: number,
    total: number,
    hasNext: boolean
  }
}
```

**Rate Limit**: 20 requests per minute (guest lookup)

#### GET /api/restaurants

**Query Parameters**:

```typescript
?search=<string>                  // Optional, search term
&timezone=<string>                // Optional, timezone filter
&minCapacity=<number>             // Optional, minimum capacity
```

**Response**:

```typescript
{
  data: [
    {
      id: string,
      name: string,
      slug: string,
      timezone: string,
      capacity: number,
      // ... other restaurant fields
    },
  ];
}
```

#### GET/PUT /api/profile

**GET Response**:

```typescript
{
  profile: {
    id: string,
    email: string,
    name: string | null,
    phone: string | null,
    image: string | null,
    created_at: string,
    updated_at: string
  }
}
```

**PUT Request**:

```typescript
{
  name?: string | null,
  phone?: string | null,
  image?: string | null
}
```

**PUT Response**:

```typescript
{
  profile: {/* same as GET */},
  idempotent: boolean
}
```

**Headers (PUT)**:

- `Idempotency-Key` (optional, generated if not provided)

**Error**:

- `400`: Email cannot be changed (if attempted)
- `409`: Idempotency key conflict

#### POST /api/lead

**Request**:

```typescript
{
  email: string;
}
```

**Response**:

```typescript
{
} // Empty object on success
```

#### GET /api/ops/bookings (Staff)

**Query Parameters**:

```typescript
?restaurantId=<UUID>
&status=pending|confirmed|cancelled|completed|no_show
&from=<ISO-8601>
&to=<ISO-8601>
&sort=asc|desc
&page=1
&pageSize=10
&query=<search term>              // Search customer name/email
```

**Response**:

```typescript
{
  items: [
    {
      id: string,
      restaurantId: string,
      restaurantName: string,
      partySize: number,
      startIso: string,
      endIso: string,
      status: string,
      notes: string | null,
      customerName: string | null,
      customerEmail: string | null
    }
  ],
  pageInfo: {
    page: number,
    pageSize: number,
    total: number,
    hasNext: boolean
  }
}
```

**Authentication**: Required (staff member)
**Authorization**: Must have membership for restaurantId
**Rate Limit**: 120 requests per minute

---

## 7. Data Flow & Dependencies

### Complete Request Flow Architecture

```
┌─────────────┐
│   Client    │
│  (Browser)  │
└──────┬──────┘
       │
       │ HTTP Request
       ▼
┌──────────────────────┐
│   Next.js Server     │
│   ┌──────────────┐   │
│   │  Middleware  │   │
│   │  (Auth/Ver)  │   │
│   └──────┬───────┘   │
│          ▼           │
│   ┌──────────────┐   │
│   │ Route Handler│   │
│   │ (API/Page)   │   │
│   └──────┬───────┘   │
└──────────┼───────────┘
           │
           ▼
┌──────────────────────┐
│   Server Layer       │
│   (server/*)         │
│                      │
│  ┌─────────────────┐ │
│  │ Business Logic  │ │
│  │  • bookings.ts  │ │
│  │  • customers.ts │ │
│  │  • loyalty.ts   │ │
│  │  • team/*.ts    │ │
│  └────────┬────────┘ │
└───────────┼──────────┘
            │
            ├─────────────────┬──────────────┬─────────────────┐
            ▼                 ▼              ▼                 ▼
     ┌──────────────┐  ┌──────────┐  ┌──────────┐     ┌──────────────┐
     │   Supabase   │  │  Upstash │  │  Inngest │     │   External   │
     │  PostgreSQL  │  │  Redis   │  │  (Jobs)  │     │     APIs     │
     │              │  │ (Rate    │  │          │     │              │
     │  • RLS       │  │  Limit)  │  │ • Emails │     │ • Mailgun    │
     │  • Triggers  │  │          │  │ • Webhks │     │ • Resend     │
     └──────────────┘  └──────────┘  └──────────┘     └──────────────┘
```

### Data Flow by Feature

#### Booking Creation Flow

```
Client → POST /api/bookings
   ↓
Route Handler (src/app/api/bookings/route.ts)
   │
   ├─ 1. Validate payload (Zod schema)
   ├─ 2. Check idempotency key
   ├─ 3. Get/create restaurant ID
   │
   ▼
Server Layer
   │
   ├─ getRestaurantSchedule() → Validate booking time against operating hours
   │
   ├─ upsertCustomer() (server/customers.ts)
   │   ├─ Normalize email/phone
   │   ├─ Upsert into customers table
   │   └─ Return customer record
   │
   ├─ getActiveLoyaltyProgram() → Check if restaurant has loyalty program
   │
   ├─ generateUniqueBookingReference() → Generate human-readable code (e.g., "AB1234")
   │
   ├─ insertBookingRecord() (server/bookings.ts)
   │   ├─ Retry loop (up to 5 attempts) for reference collision
   │   ├─ Insert into bookings table
   │   └─ Handle unique constraint violations
   │
   ├─ calculateLoyaltyAward() → If loyalty program active
   ├─ applyLoyaltyAward() → Record points in loyalty_transactions
   │
   ├─ logAuditEvent() → Record booking.created event
   │
   └─ enqueueBookingCreatedSideEffects() → Trigger background jobs
       │
       ▼
Inngest Jobs (server/jobs/)
   │
   ├─ Send confirmation email
   ├─ Send SMS notification (if configured)
   ├─ Update analytics
   └─ Trigger webhooks

   ▼
Response → { booking, loyaltyPointsAwarded, bookings, clientRequestId }
```

#### Authentication Flow

```
User clicks "Sign In"
   ↓
Navigate to /signin
   ↓
Enter email → POST to Supabase Auth (magic link)
   ↓
Email sent with magic link
   ↓
User clicks link → GET /api/auth/callback?code=XXX&redirectedFrom=/my-bookings
   ↓
Route Handler (src/app/api/auth/callback/route.ts)
   │
   ├─ Extract 'code' parameter
   ├─ supabase.auth.exchangeCodeForSession(code)
   │   ├─ Validates code with Supabase Auth service
   │   ├─ Creates session
   │   └─ Sets HTTP-only session cookies
   │
   └─ Redirect to 'redirectedFrom' or '/'
       ↓
User accesses protected route (e.g., /my-bookings)
       ↓
Middleware checks session → Allowed
       ↓
Page loads with user data
```

#### Staff Ops Booking Creation (Walk-in)

```
Staff → POST /api/ops/bookings
   ↓
Route Handler (src/app/api/ops/bookings/route.ts)
   │
   ├─ 1. getUser() → Verify staff is authenticated
   ├─ 2. Rate limit: ops:bookings:create:{userId}:{restaurantId} (60/min)
   ├─ 3. requireMembershipForRestaurant() → Verify staff has access
   ├─ 4. Validate payload (opsWalkInBookingSchema)
   │
   ▼
Server Layer
   │
   ├─ ensureFallbackContact() → Create synthetic contact if guest didn't provide
   │   │  (e.g., walkin+<uuid>@system.local, 000-<uuid>)
   │   │
   ├─ upsertCustomer() → With fallback contact
   │
   ├─ Check idempotency
   │
   ├─ generateUniqueBookingReference()
   │
   ├─ insertBookingRecord() → with details.channel = "ops.walkin"
   │
   ├─ fetchBookingsForContact()
   │
   ├─ enqueueBookingCreatedSideEffects()
   │
   └─ recordObservabilityEvent() → ops_bookings.create
       ↓
Response → { booking, bookings, idempotencyKey, clientRequestId }
```

### Service Layer Functions

#### server/bookings.ts

| Function                           | Purpose                              | Database Operations                    |
| ---------------------------------- | ------------------------------------ | -------------------------------------- |
| `insertBookingRecord()`            | Create booking                       | INSERT into bookings                   |
| `updateBookingRecord()`            | Update booking                       | UPDATE bookings                        |
| `fetchBookingsForContact()`        | Get customer bookings                | SELECT from bookings WHERE email/phone |
| `generateUniqueBookingReference()` | Generate unique code                 | Loop with collision check              |
| `deriveEndTime()`                  | Calculate end time from booking type | Pure function                          |
| `inferMealTypeFromTime()`          | Determine meal from time             | Pure function                          |
| `buildBookingAuditSnapshot()`      | Create audit trail                   | Data transformation                    |
| `logAuditEvent()`                  | Record audit event                   | INSERT into audit_events               |

#### server/customers.ts

| Function                            | Purpose                | Database Operations              |
| ----------------------------------- | ---------------------- | -------------------------------- |
| `upsertCustomer()`                  | Create/update customer | UPSERT into customers            |
| `findCustomerByContact()`           | Find customer          | SELECT from customers            |
| `normalizeEmail()`                  | Email normalization    | Pure function                    |
| `normalizePhone()`                  | Phone normalization    | Pure function                    |
| `recordBookingForCustomerProfile()` | Update customer stats  | UPDATE customers (booking count) |

#### server/loyalty.ts

| Function                    | Purpose                       | Database Operations                                |
| --------------------------- | ----------------------------- | -------------------------------------------------- |
| `getActiveLoyaltyProgram()` | Get restaurant loyalty config | SELECT from loyalty_programs                       |
| `calculateLoyaltyAward()`   | Calculate points              | Pure function (based on program rules)             |
| `applyLoyaltyAward()`       | Award points                  | INSERT into loyalty_transactions, UPDATE customers |

#### server/team/access.ts

| Function                           | Purpose               | Database Operations          |
| ---------------------------------- | --------------------- | ---------------------------- |
| `fetchUserMemberships()`           | Get staff memberships | SELECT from team_memberships |
| `requireMembershipForRestaurant()` | Verify access         | SELECT + throw if not found  |

#### server/restaurants/schedule.ts

| Function                               | Purpose             | Database Operations                           |
| -------------------------------------- | ------------------- | --------------------------------------------- |
| `getRestaurantSchedule()`              | Get operating hours | SELECT from restaurant_hours, service_periods |
| `assertBookingWithinOperatingWindow()` | Validate time       | Pure validation with error throw              |

---

## 8. Database Operations

### Database Schema Overview

**Database**: Supabase PostgreSQL  
**ORM**: None (direct Supabase client queries)  
**Type Safety**: TypeScript types generated from Supabase schema

### Main Tables

#### bookings

```sql
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  auth_user_id UUID REFERENCES auth.users(id),

  booking_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  start_at TIMESTAMPTZ GENERATED ALWAYS AS (...) STORED,
  end_at TIMESTAMPTZ GENERATED ALWAYS AS (...) STORED,

  reference VARCHAR(10) NOT NULL UNIQUE,
  party_size INTEGER NOT NULL CHECK (party_size > 0),
  booking_type VARCHAR(20) NOT NULL,
  seating_preference VARCHAR(20) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',

  customer_name VARCHAR(120) NOT NULL,
  customer_email VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(50) NOT NULL,

  notes TEXT,
  marketing_opt_in BOOLEAN DEFAULT FALSE,
  loyalty_points_awarded INTEGER DEFAULT 0,

  source VARCHAR(50) DEFAULT 'web',
  client_request_id UUID NOT NULL,
  idempotency_key VARCHAR(128),

  details JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT bookings_reference_unique UNIQUE (reference),
  CONSTRAINT bookings_client_request_unique UNIQUE (restaurant_id, client_request_id),
  CONSTRAINT bookings_idem_unique_per_restaurant UNIQUE (restaurant_id, idempotency_key)
);

-- Indexes
CREATE INDEX idx_bookings_restaurant_date ON bookings(restaurant_id, booking_date);
CREATE INDEX idx_bookings_customer ON bookings(customer_id);
CREATE INDEX idx_bookings_email ON bookings(customer_email);
CREATE INDEX idx_bookings_status ON bookings(status);
```

**Key Features**:

- **Computed columns**: `start_at`, `end_at` (from date + time)
- **Unique constraints**: reference, client_request_id, idempotency_key
- **Audit trail**: details JSONB stores request metadata

#### customers

```sql
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id),

  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  full_name VARCHAR(120),

  email_normalized VARCHAR(255) GENERATED ALWAYS AS (LOWER(TRIM(email))) STORED,
  phone_normalized VARCHAR(50) GENERATED ALWAYS AS (REGEXP_REPLACE(phone, '[^0-9]', '', 'g')) STORED,

  marketing_opt_in BOOLEAN DEFAULT FALSE,
  total_bookings INTEGER DEFAULT 0,
  cancelled_bookings INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT customers_unique_contact UNIQUE (restaurant_id, email_normalized, phone_normalized)
);
```

**Key Features**:

- **Normalized fields**: Auto-computed email_normalized, phone_normalized
- **Aggregate counters**: total_bookings, cancelled_bookings (updated via triggers/app logic)

#### restaurants

```sql
CREATE TABLE restaurants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,

  timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
  capacity INTEGER,

  address TEXT,
  phone VARCHAR(50),
  email VARCHAR(255),
  website VARCHAR(500),

  settings JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### restaurant_hours

```sql
CREATE TABLE restaurant_hours (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id),

  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  open_time TIME NOT NULL,
  close_time TIME NOT NULL,
  is_closed BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT restaurant_hours_unique UNIQUE (restaurant_id, day_of_week)
);
```

#### service_periods

```sql
CREATE TABLE service_periods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id),

  name VARCHAR(50) NOT NULL,  -- 'breakfast', 'lunch', 'dinner'
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  days_active INTEGER[] DEFAULT '{0,1,2,3,4,5,6}',

  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### team_memberships

```sql
CREATE TABLE team_memberships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),

  role VARCHAR(50) NOT NULL DEFAULT 'staff',
  permissions JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT team_memberships_unique UNIQUE (restaurant_id, user_id)
);
```

#### team_invitations

```sql
CREATE TABLE team_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id),

  email VARCHAR(255) NOT NULL,
  token VARCHAR(255) NOT NULL UNIQUE,
  role VARCHAR(50) NOT NULL,

  invited_by UUID REFERENCES auth.users(id),
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### loyalty_programs

```sql
CREATE TABLE loyalty_programs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id),

  name VARCHAR(100) NOT NULL,
  points_per_guest INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,

  rules JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### loyalty_transactions

```sql
CREATE TABLE loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id),
  booking_id UUID REFERENCES bookings(id),
  loyalty_program_id UUID NOT NULL REFERENCES loyalty_programs(id),

  points INTEGER NOT NULL,
  transaction_type VARCHAR(50) NOT NULL,  -- 'award', 'redeem', 'expire'

  metadata JSONB,
  occurred_at TIMESTAMPTZ NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### profiles

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),

  name VARCHAR(120),
  phone VARCHAR(50),
  image VARCHAR(500),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### profile_update_requests

```sql
CREATE TABLE profile_update_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES profiles(id),

  idempotency_key VARCHAR(128) NOT NULL,
  payload_hash VARCHAR(64) NOT NULL,

  applied_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT profile_update_requests_unique UNIQUE (profile_id, idempotency_key)
);
```

#### leads

```sql
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### audit_events

```sql
CREATE TABLE audit_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  action VARCHAR(100) NOT NULL,
  entity VARCHAR(50) NOT NULL,
  entity_id UUID,

  actor VARCHAR(255),
  metadata JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Database Views

#### current_bookings (view)

```sql
CREATE VIEW current_bookings AS
SELECT * FROM bookings
WHERE status NOT IN ('cancelled', 'no_show');
```

### CRUD Operations Mapping

#### Bookings

| Operation     | Route                             | SQL                                    | RLS Policy                      |
| ------------- | --------------------------------- | -------------------------------------- | ------------------------------- |
| Create        | POST /api/bookings                | INSERT                                 | Service role (bypasses RLS)     |
| Read (guest)  | GET /api/bookings?email=...       | SELECT WHERE email+phone               | Service role                    |
| Read (user)   | GET /api/bookings?me=1            | SELECT WHERE customer_email=user.email | Anon key + RLS                  |
| Update status | PUT /api/ops/bookings/[id]/status | UPDATE bookings SET status             | Service role + membership check |
| Read history  | GET /api/bookings/[id]/history    | SELECT from audit_events               | Service role                    |

#### Customers

| Operation    | SQL                                              | Triggered By                        |
| ------------ | ------------------------------------------------ | ----------------------------------- |
| Upsert       | UPSERT (ON CONFLICT)                             | Every booking creation              |
| Find         | SELECT WHERE email_normalized + phone_normalized | Booking lookup                      |
| Update stats | UPDATE total_bookings, cancelled_bookings        | After booking creation/cancellation |

#### Restaurants

| Operation      | Route                                   | SQL                                           |
| -------------- | --------------------------------------- | --------------------------------------------- |
| List           | GET /api/restaurants                    | SELECT with filters                           |
| Get schedule   | GET /api/restaurants/[slug]/schedule    | SELECT from restaurant_hours, service_periods |
| Update details | PUT /api/owner/restaurants/[id]/details | UPDATE restaurants                            |
| Update hours   | PUT /api/owner/restaurants/[id]/hours   | UPSERT restaurant_hours                       |

#### Team Management

| Operation         | Route                                     | SQL                                  |
| ----------------- | ----------------------------------------- | ------------------------------------ |
| List memberships  | GET /api/owner/team/memberships           | SELECT from team_memberships         |
| Create invitation | POST /api/owner/team/invitations          | INSERT into team_invitations         |
| Get invitation    | GET /api/team/invitations/[token]         | SELECT WHERE token                   |
| Accept invitation | POST /api/team/invitations/[token]/accept | DELETE invitation, INSERT membership |

### Row Level Security (RLS) Policies

**Note**: Most operations use the service role key and bypass RLS. Policies are in place for:

- **bookings**: Users can read their own bookings (WHERE customer_email = auth.jwt()->email)
- **profiles**: Users can read/update their own profile (WHERE id = auth.uid())
- **team_memberships**: Members can read memberships for their restaurants

---

## 9. Business Logic Mapping

### Core Business Rules

#### Booking Creation

1. **Operating Hours Validation**
   - Booking time must fall within restaurant operating hours
   - Checked via `assertBookingWithinOperatingWindow()`
   - Throws `OperatingHoursError` if outside window

2. **Reference Generation**
   - Human-readable 6-character code (e.g., "AB1234")
   - Pattern: 2 uppercase letters + 4 digits
   - Must be globally unique (retry up to 5 times)

3. **End Time Calculation**
   - Breakfast: +1.5 hours
   - Lunch/Dinner: +2 hours
   - Drinks: +1 hour
   - Function: `deriveEndTime(startTime, bookingType)`

4. **Meal Type Inference**
   - If bookingType === "drinks", use "drinks"
   - Otherwise, infer from time:
     - 05:00-11:00 → breakfast
     - 11:00-15:00 → lunch
     - 15:00-23:59 → dinner

5. **Customer Deduplication**
   - Upsert on `(restaurant_id, email_normalized, phone_normalized)`
   - Updates existing record if found
   - Creates new if not found

6. **Idempotency**
   - Header: `Idempotency-Key`
   - Stored in `bookings.idempotency_key`
   - If duplicate key with same payload → return existing booking
   - If duplicate key with different payload → 409 Conflict

7. **Loyalty Points**
   - Check if restaurant has active loyalty program
   - Calculate: `points_per_guest * party_size`
   - Record in `loyalty_transactions`
   - Update `bookings.loyalty_points_awarded`

8. **Audit Trail**
   - Every booking creation logs to `audit_events`
   - Action: "booking.created"
   - Metadata: includes before/after snapshot

9. **Side Effects (Background Jobs)**
   - Confirmation email sent via Inngest
   - SMS notification (if configured)
   - Analytics tracking
   - Webhook triggers

#### Walk-In Booking (Ops)

1. **Fallback Contact Generation**
   - If email missing: `walkin+<client_request_id>@system.local`
   - If phone missing: `000-<client_request_id>`
   - Allows staff to create bookings without full customer info

2. **Staff Authorization**
   - Requires authenticated user
   - Must have team membership for restaurant
   - Function: `requireMembershipForRestaurant()`

3. **Metadata Enrichment**
   - `details.channel` = "ops.walkin"
   - `details.staff.id` = staff user ID
   - `details.provided_contact` = flags for email/phone presence

#### Guest Lookup

1. **Hash-Based Lookup (Feature Flag)**
   - If `env.featureFlags.guestLookupPolicy` enabled
   - Compute hash: `SHA256(restaurantId + email + phone + pepper)`
   - Call `get_guest_bookings(p_restaurant_id, p_hash)`
   - Protects against rainbow table attacks

2. **Legacy Lookup (Fallback)**
   - Direct query: `SELECT WHERE customer_email = ? AND customer_phone = ?`
   - Used if hash-based lookup fails or feature flag disabled

3. **Rate Limiting**
   - 20 requests per minute per (restaurant, IP)
   - Key: `bookings:lookup:{restaurantId}:{clientIp}`

#### Profile Management

1. **Email Immutability**
   - Email is set from Supabase Auth
   - Cannot be changed via `/api/profile`
   - Returns 400 if attempted

2. **Profile Idempotency**
   - Uses `profile_update_requests` table
   - Payload hash: SHA256(sorted JSON)
   - Prevents duplicate updates with same content

3. **Ensure Profile Row**
   - Function: `ensureProfileRow(supabase, user)`
   - Creates profile row if doesn't exist (INSERT ON CONFLICT)
   - Returns existing or newly created profile

### Validation Rules

#### Booking Payload

```typescript
{
  date: /^\d{4}-\d{2}-\d{2}$/,       // YYYY-MM-DD
  time: /^\d{2}:\d{2}$/,             // HH:MM
  party: min(1),                     // At least 1 guest
  bookingType: enum(BOOKING_TYPES),  // breakfast|lunch|dinner|drinks
  seating: enum(SEATING_OPTIONS),    // indoor|outdoor|bar|any
  notes: max(500),                   // Optional, max 500 chars
  name: min(2).max(120),             // Required
  email: email(),                    // Valid email
  phone: min(7).max(50),             // Phone number
  marketingOptIn: boolean(),         // Default: false
}
```

#### Restaurant Filters

```typescript
{
  search: string().optional(),          // Free text search
  timezone: string().optional(),        // Timezone code
  minCapacity: number().int().min(0),   // Minimum capacity
}
```

#### Ops Bookings Query

```typescript
{
  restaurantId: uuid().optional(),
  status: enum(['pending', 'confirmed', 'cancelled', 'completed', 'no_show']),
  from: datetime({ offset: true }),    // ISO-8601 with timezone
  to: datetime({ offset: true }),
  sort: enum(['asc', 'desc']),
  page: int().min(1).default(1),
  pageSize: int().min(1).max(50).default(10),
  query: string().trim().max(80),      // Customer name/email search
}
```

### State Transitions

#### Booking Status

```
┌─────────┐
│ pending │ ←─────────────┐
└────┬────┘                │
     │                     │
     ▼                     │
┌────────────────────┐     │
│ pending_allocation │     │
└────┬───────────────┘     │
     │                     │
     ▼                     │
┌───────────┐              │
│ confirmed │              │
└────┬──────┘              │
     │                     │
     ├─────────────────────┤
     │                     │
     ▼                     ▼
┌───────────┐        ┌───────────┐
│ completed │        │ cancelled │
└───────────┘        └───────────┘
     │                     │
     │                     ▼
     │              ┌─────────┐
     │              │ no_show │
     │              └─────────┘
     │
     ▼
  [Final]
```

**Blocking Statuses**: ['cancelled', 'no_show', 'completed']  
(Cannot be modified once in these states)

---

## 10. Route Dependencies & Relationships

### Sequential Dependencies

#### Booking Flow

```
1. GET /api/restaurants
   → Returns list of restaurants

2. GET /api/restaurants/[slug]/schedule
   → Get operating hours for selected restaurant

3. POST /api/bookings
   → Create booking
   → Returns booking with reference

4. (Optional) GET /api/bookings?email=...&phone=...
   → Retrieve booking using guest lookup
```

#### Profile Flow

```
1. User authenticates → GET /api/auth/callback?code=XXX
   → Session established

2. GET /api/profile
   → Fetch user profile

3. POST /api/profile/image
   → Upload profile image
   → Returns image URL

4. PUT /api/profile (with image URL)
   → Update profile with image
```

#### Team Invitation Flow

```
1. POST /api/owner/team/invitations
   → Creates invitation
   → Sends email with token
   → Returns invitation record

2. GET /api/team/invitations/[token]
   → Recipient views invitation details

3. POST /api/team/invitations/[token]/accept
   → Accept invitation
   → Creates team_membership
   → Deletes invitation
```

#### Ops Walk-In Flow

```
1. Staff navigates to /ops/bookings/new

2. POST /api/ops/bookings
   → Creates walk-in booking
   → Returns booking with generated reference

3. Staff can view in /ops/bookings
   → GET /api/ops/bookings
```

### Interdependent Routes

| Route A                          | Relation | Route B                              | Description                          |
| -------------------------------- | -------- | ------------------------------------ | ------------------------------------ |
| POST /api/bookings               | Triggers | Booking side-effect processor        | Sends confirmation email + analytics |
| POST /api/bookings               | Reads    | GET /api/restaurants/[slug]/schedule | Validates operating hours            |
| POST /api/bookings               | Updates  | Customer record                      | Upserts customer                     |
| PUT /api/profile                 | Checks   | GET /api/profile                     | Ensures profile exists               |
| POST /api/ops/bookings           | Requires | Team membership                      | Authorization check                  |
| POST /api/owner/team/invitations | Creates  | Email                                | Sends invitation via Resend          |
| POST /api/lead                   | Stores   | leads table                          | Lead capture                         |

## 11. Edge Cases & Special Routes

### Special Route Behaviors

#### 404 Not Found

- **File**: `src/app/not-found.tsx`
- Custom 404 page rendered for unmatched routes

#### Error Boundary

- **File**: `src/app/error.tsx`
- Catches runtime errors in page components
- Displays user-friendly error UI

#### API Versioning Sunset

- **All unversioned /api/\* routes** (except /api/v1/\*)
- Returns deprecation headers:
  - `Deprecation: true`
  - `Sunset: <ISO-8601 date>`
  - `Link: </api/v1/...>; rel="successor-version"`
- Grace period: 30 days (configurable)

### Development-Only Routes

#### Testing Endpoints

| Route                                        | Purpose                 | Should Be Disabled In Production |
| -------------------------------------------- | ----------------------- | -------------------------------- |
| POST /api/test/invitations                   | Create test invitations | ✅ Yes                           |
| POST /api/test/leads                         | Create test leads       | ✅ Yes                           |
| POST /api/test/bookings                      | Create test bookings    | ✅ Yes                           |
| POST /api/test/playwright-session            | E2E auth setup          | ✅ Yes                           |
| GET /api/test/reservations/[id]/confirmation | Test confirmation       | ✅ Yes                           |
| POST /api/test-email                         | Email testing           | ✅ Yes                           |

**Security Note**: These routes should be gated behind environment checks:

```typescript
if (process.env.NODE_ENV === 'production') {
  return NextResponse.json({ error: 'Not available in production' }, { status: 404 });
}
```

### Fallback & Default Behaviors

#### Default Restaurant

```typescript
// If restaurantId not provided, use default
const restaurantId = data.restaurantId ?? (await getDefaultRestaurantId());

// Resolution order:
// 1. env.misc.bookingDefaultRestaurantId
// 2. Restaurant with slug = NEXT_PUBLIC_DEFAULT_RESTAURANT_SLUG
// 3. Oldest restaurant (first created)
// 4. Fallback UUID: "39cb1346-20fb-4fa2-b163-0230e1caf749"
```

#### Auth Redirect

```typescript
// After successful login, redirect to:
// 1. ?redirectedFrom query param
// 2. config.auth.callbackUrl (default: "/")
```

#### Rate Limit Storage Fallback

```typescript
// If Upstash Redis not configured:
// 1. Log warning (development only, silent in production)
// 2. Fall back to in-memory Map
// 3. Note: In-memory limits are NOT shared across instances
```

### Static File Routes

| Route                  | Purpose                                  |
| ---------------------- | ---------------------------------------- |
| `/favicon.ico`         | Browser favicon                          |
| `/apple-icon.png`      | iOS app icon                             |
| `/opengraph-image.png` | Social sharing image                     |
| `/twitter-image.png`   | Twitter card image                       |
| `/robots.txt`          | Search engine crawler rules              |
| `/sitemap.xml`         | SEO sitemap (generated via next-sitemap) |

---

## 12. Security Analysis

### Input Sanitization

#### Zod Validation

All API routes use Zod schemas for type-safe validation before processing:

```typescript
const bookingSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  party: z.number().int().min(1),
  // ... other fields with constraints
});

const parsed = bookingSchema.safeParse(payload);
if (!parsed.success) {
  return handleZodError(parsed.error);
}
```

**Benefits**:

- Type coercion and validation
- Prevents SQL injection (parameterized queries via Supabase)
- Blocks XSS in JSON payloads
- Enforces data constraints (min/max length, format patterns)

#### Email & Phone Normalization

```typescript
// Email: lowercase + trim
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// Phone: remove non-digits
function normalizePhone(phone: string): string {
  return phone.replace(/[^0-9]/g, '');
}
```

**Purpose**: Consistent storage, deduplication, safe comparison

#### Search Query Sanitization

```typescript
function sanitizeSearchTerm(input: string): string {
  return input.replace(/([\\%_])/g, '\\$1');
}

// Used in ILIKE queries to prevent SQL pattern injection
const pattern = `%${sanitizeSearchTerm(query)}%`;
```

**Prevents**: SQL LIKE pattern injection (escapes `%`, `_`, `\`)

### SQL Injection Protection

**Primary Defense**: Supabase client uses parameterized queries

```typescript
// ✅ SAFE - Parameters are escaped
await supabase
  .from('bookings')
  .select('*')
  .eq('customer_email', email) // email is escaped
  .eq('status', 'confirmed');

// ❌ UNSAFE - Never used in this codebase
await supabase.rpc('unsafe_query', { sql: `SELECT * FROM bookings WHERE email = '${email}'` });
```

**Additional Protections**:

- Row Level Security (RLS) policies on Supabase tables
- Service role key used for most operations (bypasses RLS but logs all access)
- No raw SQL queries found in codebase

### XSS Prevention

#### API Responses

- All responses are JSON (Content-Type: application/json)
- React auto-escapes string interpolation
- No `dangerouslySetInnerHTML` usage found

#### User-Generated Content

- Booking notes: Max 500 chars, validated via Zod
- Customer names: Max 120 chars, validated
- No rich text fields (no HTML in user input)

### CSRF Protection

**Next.js Default**: SameSite cookies for session management

```typescript
// Supabase SSR sets cookies with:
// SameSite=Lax (default)
// HttpOnly=true (prevents XSS access)
// Secure=true (HTTPS only in production)
```

**Additional CSRF Mitigation**:

- State-changing operations use POST/PUT/DELETE (not GET)
- Idempotency keys prevent replay attacks

### Rate Limiting

#### Implementation

**Storage**:

- **Production**: Upstash Redis (distributed, cross-instance)
- **Development**: In-memory Map (single instance only)

**Algorithm**: Fixed window counter per identifier

```typescript
await consumeRateLimit({
  identifier: 'bookings:lookup:restaurant-123:192.168.1.1',
  limit: 20,
  windowMs: 60_000, // 1 minute
});
```

**Response on Limit Exceeded**:

```typescript
HTTP/1.1 429 Too Many Requests
Retry-After: 42

{
  "error": "Too many requests",
  "code": "RATE_LIMITED",
  "retryAfter": 42
}
```

#### Rate Limit Configurations

| Endpoint Pattern     | Identifier                                    | Limit | Window | Purpose                                     |
| -------------------- | --------------------------------------------- | ----- | ------ | ------------------------------------------- |
| Guest booking lookup | `bookings:lookup:{restaurantId}:{clientIp}`   | 20    | 60s    | Prevent brute-force email/phone enumeration |
| Ops bookings list    | `ops:bookings:get:{userId}`                   | 120   | 60s    | Prevent resource exhaustion                 |
| Ops booking create   | `ops:bookings:create:{userId}:{restaurantId}` | 60    | 60s    | Prevent spam bookings                       |

#### IP Extraction & Anonymization

```typescript
function extractClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

function anonymizeIp(ip: string): string {
  // IPv4: 192.168.1.1 → 192.168.1.0
  // IPv6: 2001:db8::1 → 2001:db8::/32
  // Logged for observability without full IP storage
}
```

### Authentication Security

#### Session Management

- **Provider**: Supabase Auth
- **Storage**: HTTP-only cookies (not accessible to JavaScript)
- **Expiration**: Configurable (default: 1 hour access token, 30 days refresh token)
- **Rotation**: Refresh token automatically rotated on use

#### Magic Link Security

- **One-time use**: Code is invalidated after exchange
- **Expiration**: Link expires after configurable period (default: 1 hour)
- **HTTPS only**: Links only work over HTTPS in production

#### Token Verification

```typescript
const {
  data: { user },
  error,
} = await supabase.auth.getUser();

if (error || !user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

### Authorization Checks

#### Staff Access

```typescript
// Verify user has membership for restaurant
const memberships = await fetchUserMemberships(userId, supabase);
const allowed = memberships.some((m) => m.restaurant_id === targetRestaurantId);

if (!allowed) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

#### Row-Level Security (RLS)

**Example RLS Policy** (on `bookings` table):

```sql
-- Users can read their own bookings
CREATE POLICY "Users can view their own bookings"
  ON bookings
  FOR SELECT
  USING (auth.jwt() ->> 'email' = customer_email);
```

**Service Role Bypass**: Most operations use service role key, which bypasses RLS but is logged

### Data Encryption

#### In Transit

- HTTPS enforced (Next.js + Vercel/hosting platform)
- Supabase connections over HTTPS

#### At Rest

- Supabase PostgreSQL: Encryption at rest via cloud provider
- Passwords: Not stored (passwordless auth via magic links)
- Sensitive keys: Environment variables, not committed to repo

### Secrets Management

```typescript
// ✅ GOOD - Environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ❌ BAD - Hardcoded secrets (NOT found in this codebase)
const apiKey = 'sk_live_abc123...';
```

**Environment Variables**:

- `.env.local` (gitignored)
- Vercel/hosting platform environment settings
- Validated at build time via `scripts/validate-env.ts`

### Observability & Audit Trails

#### Audit Events

```typescript
await logAuditEvent(supabase, {
  action: 'booking.created',
  entity: 'booking',
  entityId: booking.id,
  metadata: {
    restaurant_id: restaurantId,
    customer_id: customerId,
    reference: booking.reference,
    // ... audit snapshot
  },
  actor: email,
});
```

**Table**: `audit_events`  
**Events Logged**: booking.created, booking.updated, booking.cancelled

#### Observability Events

```typescript
await recordObservabilityEvent({
  source: 'api.ops',
  eventType: 'ops_bookings.rate_limited',
  severity: 'warning',
  context: {
    staff_id: userId,
    restaurant_id: restaurantId,
    ip_scope: anonymizeIp(clientIp),
  },
});
```

**Purpose**: Monitoring, alerting, debugging (without storing PII)

### Guest Lookup Security

#### Hash-Based Lookup (Feature Flag)

**Purpose**: Prevent rainbow table attacks on email/phone combinations

```typescript
// Compute hash with restaurant-specific pepper
const contactHash = computeGuestLookupHash({
  restaurantId,
  email,
  phone,
});

// Query by hash instead of plaintext
const { data } = await supabase.rpc('get_guest_bookings', {
  p_restaurant_id: restaurantId,
  p_hash: contactHash,
});
```

**Security Properties**:

- Hash includes restaurant-specific pepper (secret)
- Cannot reverse-engineer email/phone from hash
- Rate limited (20 lookups per minute per IP)

---

## 13. Performance Considerations

### Caching Strategies

#### Default Restaurant ID Caching

```typescript
let cachedDefaultRestaurantId: string | null = null;

export async function getDefaultRestaurantId(): Promise<string> {
  if (cachedDefaultRestaurantId) {
    return cachedDefaultRestaurantId;
  }

  // Fetch from database once
  const id = await fetchDefaultRestaurantId();
  cachedDefaultRestaurantId = id;
  return id;
}
```

**Impact**: Reduces repeated database queries for default restaurant lookup

#### Supabase Service Client Singleton

```typescript
let serviceClient: SupabaseClient | null = null;

export function getServiceSupabaseClient(): SupabaseClient {
  if (!serviceClient) {
    serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  }
  return serviceClient;
}
```

**Impact**: Reuses single client instance across requests (connection pooling)

### Database Query Optimization

#### Indexes

- `idx_bookings_restaurant_date` on `(restaurant_id, booking_date)` - Booking searches
- `idx_bookings_customer` on `(customer_id)` - Customer history
- `idx_bookings_email` on `(customer_email)` - Guest lookup
- `idx_bookings_status` on `(status)` - Status filtering

#### Pagination

- All list endpoints use `range(offset, limit)` pagination
- Default page size: 10, max: 50
- Prevents unbounded queries

```typescript
query = query.range(offset, offset + pageSize - 1);
```

#### Computed Columns

- `start_at`, `end_at` generated from `booking_date + start_time/end_time`
- Eliminates need for runtime timestamp computation
- Indexed for fast sorting and range queries

### Heavy Computation Routes

#### CSV Export (Ops)

**Routes**:

- GET /api/ops/bookings/export
- GET /api/ops/customers/export

**Optimization Needed**:

- Streaming response for large datasets
- Background job for very large exports (not currently implemented)
- Row limit or time-based chunking

#### Booking Reference Generation

```typescript
for (let attempt = 0; attempt < 5 && !booking; attempt += 1) {
  reference = await generateUniqueBookingReference(supabase);

  try {
    booking = await insertBookingRecord(supabase, { reference, ... });
  } catch (error) {
    if (isDuplicateReferenceError(error)) {
      continue;  // Retry with new reference
    }
    throw error;
  }
}
```

**Performance**:

- Max 5 retries to prevent infinite loops
- Collision rare (6-character alphanumeric = 2,176,782,336 possibilities)

### Async Processing (Background Jobs)

#### Inngest Integration

**Enabled**: Controlled by `env.queue.useAsyncSideEffects`

**Events**:

- `sajiloreservex/booking.created.side-effects`
- `sajiloreservex/booking.updated.side-effects`
- `sajiloreservex/booking.cancelled.side-effects`

**Side Effects** (non-blocking):

- Email confirmation
- SMS notifications
- Analytics events
- Webhook triggers

**Benefits**:

- API response time: ~200-500ms (without waiting for email)
- Resilient: Jobs retried on failure
- Monitoring: Inngest dashboard tracks job status

#### Synchronous Fallback

```typescript
if (!isAsyncQueueEnabled()) {
  // Synchronous processing (dev/testing)
  await processBookingCreatedSideEffects(payload);
}
```

### Network Optimization

#### API Response Size

- DTOs (Data Transfer Objects) used to limit fields returned
- Nested relations fetched selectively:
  ```typescript
  .select("id, start_at, ..., restaurants(name)")
  ```

#### Pagination Headers

- `pageInfo.hasNext` indicates more results available
- Prevents over-fetching

### Monitoring & Profiling

#### Logging

- Structured logging with context:

  ```typescript
  console.error('[bookings][POST]', { restaurantId, error });
  ```

- Performance-critical paths logged:
  ```typescript
  console.log(`[resend] Sending email to: ${to}, subject: "${subject}"`);
  ```

#### Observability Events

- Track slow operations, rate limits, failures
- Anonymized metadata (no PII in logs)

---

## 14. External Integrations

### Email Service Providers

#### Resend (Primary)

**Configuration**:

```typescript
import { Resend } from 'resend';

const resendClient = new Resend(env.resend.apiKey);
```

**Function**: `sendEmail()` in `libs/resend.ts`

**Features**:

- HTML + Text emails
- Attachments support
- CC/BCC
- Custom "From" name
- Reply-To address

**Usage**:

- Booking confirmations
- Booking updates
- Booking cancellations
- Team invitations

**Error Handling**:

- Logs errors to console
- Throws exception (caught by calling route which falls back to synchronous handling)

### Side-Effect Processing

Booking confirmation, update, and cancellation notifications run synchronously via
`enqueueBooking{Created,Updated,Cancelled}SideEffects`. When invoked, these helpers:

- Record analytics events (with Supabase service role)
- Dispatch the appropriate Resend email
- Return `{ queued: false }` to indicate inline completion

There is no external queue dependency; if any step fails, the error is logged and surfaced to the caller for observability.

### Rate Limiting Cache

#### Upstash Redis

**Configuration**:

```typescript
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: env.cache.upstash.restUrl,
  token: env.cache.upstash.restToken,
});
```

**Operations**:

- `INCR <key>` - Increment counter
- `PEXPIRE <key> <ms>` - Set TTL

**Fallback**: In-memory Map (not suitable for multi-instance deployments)

**Keys**:

- `rl:bookings:lookup:{restaurantId}:{clientIp}:{windowStart}`
- `rl:ops:bookings:get:{userId}:{windowStart}`
- `rl:ops:bookings:create:{userId}:{restaurantId}:{windowStart}`

### Database Service

#### Supabase

**PostgreSQL Version**: 15+  
**Extensions**: uuid-ossp, pgcrypto

**Client Types**:

1. **Anon Key Client** (public operations, RLS enforced)
2. **Service Role Key Client** (bypass RLS, full access)

**Realtime Features**: Not used in current implementation

**Auth Features**:

- Magic link emails
- OAuth providers (configurable)
- Session management
- User metadata storage

**Storage**: Supabase Storage (for profile images via `/api/profile/image`)

### Webhook Integrations

No inbound webhooks are currently active; legacy Mailgun handlers have been removed alongside their secrets.

#### Custom Webhooks (Outgoing)

**Trigger Points**:

- Booking created
- Booking confirmed
- Booking cancelled

**Configuration**: Per-restaurant webhook URLs (stored in `restaurants.settings.webhooks`)

**Payload Example**:

```json
{
  "event": "booking.created",
  "timestamp": "2025-01-15T10:30:00Z",
  "data": {
    "booking_id": "uuid",
    "reference": "AB1234",
    "customer_email": "customer@example.com",
    "party_size": 4,
    "booking_date": "2025-01-20",
    "start_time": "19:00"
  }
}
```

### Analytics

**Event Tracking**:

- `recordBookingCreatedEvent()`
- `recordBookingCancelledEvent()`

**Storage**: Analytics events table (schema not fully visible, likely in Supabase)

**Purpose**:

- Dashboard metrics (occupancy, revenue, trends)
- Customer behavior tracking
- Restaurant performance insights

### SMS Provider (Placeholder)

**Not Currently Implemented**:

- TODO: Integrate Twilio/AWS SNS for SMS confirmations
- Placeholder in job handlers

---

## 15. Visual Representations

### A. Route Tree Diagram (Detailed)

```
📁 src/app/
│
├── 📄 page.tsx                              → / (Landing)
├── 📄 layout.tsx                            → Root layout
├── 📄 error.tsx                             → Error boundary
├── 📄 not-found.tsx                         → 404 page
├── 📄 globals.css                           → Global styles
├── 📄 providers.tsx                         → React providers
│
├── 📁 (authed)/                             → Protected routes group
│   ├── 📁 my-bookings/
│   │   └── 📄 page.tsx                      → /my-bookings
│   ├── 📁 profile/
│   │   └── 📁 manage/
│   │       └── 📄 page.tsx                  → /profile/manage
│   └── 📁 manage-restaurant/
│       └── (deprecated)
│
├── 📁 (customer)/                           → Customer routes group
│   ├── 📁 (account)/
│   │   └── (nested customer account routes)
│   └── 📁 (guest)/
│       └── (guest-specific routes)
│
├── 📁 (ops)/                                → Ops console group
│   └── 📁 ops/
│       ├── 📁 (public)/
│       │   └── 📁 login/
│       │       └── 📄 page.tsx              → /ops/login
│       └── 📁 (app)/
│           ├── 📄 page.tsx                  → /ops (dashboard)
│           ├── 📁 bookings/
│           │   ├── 📄 page.tsx              → /ops/bookings
│           │   └── 📁 new/
│           │       └── 📄 page.tsx          → /ops/bookings/new
│           ├── 📁 customer-details/
│           │   └── 📄 page.tsx              → /ops/customer-details
│           ├── 📁 team/
│           │   └── 📄 page.tsx              → /ops/team
│           └── 📁 restaurant-settings/
│               └── 📄 page.tsx              → /ops/restaurant-settings
│
├── 📁 api/                                  → API routes
│   ├── 📁 auth/
│   │   └── 📁 callback/
│   │       └── 📄 route.ts                  → GET /api/auth/callback
│   │
│   ├── 📁 bookings/
│   │   ├── 📄 route.ts                      → GET, POST /api/bookings
│   │   └── 📁 [id]/
│   │       ├── 📄 route.ts                  → GET /api/bookings/[id]
│   │       └── 📁 history/
│   │           └── 📄 route.ts              → GET /api/bookings/[id]/history
│   │
│   ├── 📁 restaurants/
│   │   ├── 📄 route.ts                      → GET /api/restaurants
│   │   └── 📁 [slug]/
│   │       └── 📁 schedule/
│   │           └── 📄 route.ts              → GET /api/restaurants/[slug]/schedule
│   │
│   ├── 📁 profile/
│   │   ├── 📄 route.ts                      → GET, PUT /api/profile
│   │   └── 📁 image/
│   │       └── 📄 route.ts                  → POST /api/profile/image
│   │
│   ├── 📁 lead/
│   │   └── 📄 route.ts                      → POST /api/lead
│   │
│   ├── 📁 events/
│   │   └── 📄 route.ts                      → POST /api/events
│   │
│   ├── 📁 team/
│   │   └── 📁 invitations/
│   │       └── 📁 [token]/
│   │           ├── 📄 route.ts              → GET /api/team/invitations/[token]
│   │           └── 📁 accept/
│   │               └── 📄 route.ts          → POST /api/team/invitations/[token]/accept
│   │
│   ├── 📁 ops/                              → Staff API
│   │   ├── 📁 bookings/
│   │   │   ├── 📄 route.ts                  → GET, POST /api/ops/bookings
│   │   │   ├── 📁 [id]/
│   │   │   │   ├── 📄 route.ts              → GET /api/ops/bookings/[id]
│   │   │   │   └── 📁 status/
│   │   │   │       └── 📄 route.ts          → PUT /api/ops/bookings/[id]/status
│   │   │   └── 📁 export/
│   │   │       └── 📄 route.ts              → GET /api/ops/bookings/export
│   │   ├── 📁 customers/
│   │   │   ├── 📄 route.ts                  → GET /api/ops/customers
│   │   │   └── 📁 export/
│   │   │       └── 📄 route.ts              → GET /api/ops/customers/export
│   │   ├── 📁 restaurants/
│   │   │   ├── 📄 route.ts                  → GET /api/ops/restaurants
│   │   │   └── 📁 [id]/
│   │   │       └── 📄 route.ts              → GET /api/ops/restaurants/[id]
│   │   └── 📁 dashboard/
│   │       ├── 📁 summary/
│   │       │   └── 📄 route.ts              → GET /api/ops/dashboard/summary
│   │       ├── 📁 heatmap/
│   │       │   └── 📄 route.ts              → GET /api/ops/dashboard/heatmap
│   │       ├── 📁 capacity/
│   │       │   └── 📄 route.ts              → GET /api/ops/dashboard/capacity
│   │       ├── 📁 vips/
│   │       │   └── 📄 route.ts              → GET /api/ops/dashboard/vips
│   │       └── 📁 changes/
│   │           └── 📄 route.ts              → GET /api/ops/dashboard/changes
│   │
│   ├── 📁 owner/                            → Restaurant owner API
│   │   ├── 📁 team/
│   │   │   ├── 📁 invitations/
│   │   │   │   ├── 📄 route.ts              → GET, POST /api/owner/team/invitations
│   │   │   │   └── 📁 [inviteId]/
│   │   │   │       └── 📄 route.ts          → DELETE /api/owner/team/invitations/[inviteId]
│   │   │   └── 📁 memberships/
│   │   │       └── 📄 route.ts              → GET, POST /api/owner/team/memberships
│   │   └── 📁 restaurants/
│   │       └── 📁 [id]/
│   │           ├── 📁 details/
│   │           │   └── 📄 route.ts          → PUT /api/owner/restaurants/[id]/details
│   │           ├── 📁 hours/
│   │           │   └── 📄 route.ts          → GET, PUT /api/owner/restaurants/[id]/hours
│   │           └── 📁 service-periods/
│   │               └── 📄 route.ts          → GET, POST /api/owner/restaurants/[id]/service-periods
│   │
│   ├── 📁 test/                             → Test/dev endpoints
│   │   ├── 📁 invitations/
│   │   │   └── 📄 route.ts
│   │   ├── 📁 leads/
│   │   │   └── 📄 route.ts
│   │   ├── 📁 bookings/
│   │   │   └── 📄 route.ts
│   │   ├── 📁 playwright-session/
│   │   │   └── 📄 route.ts
│   │   └── 📁 reservations/
│   │       └── 📁 [reservationId]/
│   │           └── 📁 confirmation/
│   │               └── 📄 route.ts
│   │
│   ├── 📁 test-email/
│   │   └── 📄 route.ts                      → POST /api/test-email
│   │
│   └── 📁 v1/                               → Versioned API (re-exports)
│       ├── 📁 bookings/
│       │   └── 📄 route.ts                  → export from ../../bookings/route
│       ├── 📁 profile/
│       │   ├── 📄 route.ts
│       │   └── 📁 image/
│       │       └── 📄 route.ts
│       ├── 📁 events/
│       │   └── 📄 route.ts
│       ├── 📁 lead/
│       │   └── 📄 route.ts
│       └── 📁 test/
│           └── ...
│
├── 📁 browse/
│   └── 📄 page.tsx                          → /browse
├── 📁 create/
│   └── 📄 page.tsx                          → /create
├── 📁 checkout/
│   └── 📄 page.tsx                          → /checkout
├── 📁 signin/
│   └── 📄 page.tsx                          → /signin
├── 📁 thank-you/
│   └── 📄 page.tsx                          → /thank-you
├── 📁 pricing/
│   └── 📄 page.tsx                          → /pricing
├── 📁 reserve/
│   ├── 📄 page.tsx                          → /reserve
│   ├── 📁 [reservationId]/
│   │   └── 📄 page.tsx                      → /reserve/[reservationId]
│   └── 📁 r/
│       └── 📁 [slug]/
│           └── 📄 page.tsx                  → /reserve/r/[slug]
├── 📁 item/
│   └── 📁 [slug]/
│       └── 📄 page.tsx                      → /item/[slug]
├── 📁 invite/
│   └── 📁 [token]/
│       └── 📄 page.tsx                      → /invite/[token]
├── 📁 blog/
│   ├── 📄 page.tsx                          → /blog
│   ├── 📁 [articleId]/
│   │   └── 📄 page.tsx                      → /blog/[articleId]
│   ├── 📁 author/
│   │   └── 📁 [authorId]/
│   │       └── 📄 page.tsx                  → /blog/author/[authorId]
│   └── 📁 category/
│       └── 📁 [categoryId]/
│           └── 📄 page.tsx                  → /blog/category/[categoryId]
├── 📁 tos/
│   └── 📄 page.tsx                          → /tos
├── 📁 privacy-policy/
│   └── 📄 page.tsx                          → /privacy-policy
└── 📁 terms/
    ├── 📁 venue/
    │   └── 📄 page.tsx                      → /terms/venue
    └── 📁 togo/
        └── 📄 page.tsx                      → /terms/togo
```

### B. Request Flow Diagram (Booking Creation)

```
┌──────────────────────────────────────────────────────────────────────┐
│                         Client Application                           │
└───────────────────────────────┬──────────────────────────────────────┘
                                │
                                │ POST /api/bookings
                                │ Headers: { Idempotency-Key, User-Agent }
                                │ Body: { date, time, party, ... }
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│                         Next.js Middleware                           │
│  1. Add API versioning headers (Deprecation, Sunset)                │
│  2. No auth required for this route (public booking endpoint)        │
└───────────────────────────────┬──────────────────────────────────────┘
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│               Route Handler: /api/bookings/route.ts                  │
│  1. Parse JSON body                                                  │
│  2. Validate with Zod schema (bookingSchema)                         │
│  3. Normalize idempotency key                                        │
│  4. Generate client_request_id                                       │
└───────────────────────────────┬──────────────────────────────────────┘
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      Server Layer Functions                          │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ getRestaurantSchedule()                                      │    │
│  │  • Fetch operating hours for restaurant                     │    │
│  │  • Fetch service periods (breakfast/lunch/dinner)           │    │
│  └────────────────────┬───────────────────────────────────────┘    │
│                       ▼                                              │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ assertBookingWithinOperatingWindow()                         │    │
│  │  • Validate requested time is within hours                  │    │
│  │  • Throw OperatingHoursError if outside window              │    │
│  └────────────────────┬───────────────────────────────────────┘    │
│                       ▼                                              │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ upsertCustomer()                                            │    │
│  │  • Normalize email (lowercase, trim)                        │    │
│  │  • Normalize phone (digits only)                            │    │
│  │  • UPSERT into customers table                              │    │
│  │    ON CONFLICT (restaurant_id, email_norm, phone_norm)      │    │
│  └────────────────────┬───────────────────────────────────────┘    │
│                       ▼                                              │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ Check idempotency_key                                       │    │
│  │  • SELECT WHERE idempotency_key = ?                         │    │
│  │  • If exists: return existing booking                       │    │
│  └────────────────────┬───────────────────────────────────────┘    │
│                       ▼                                              │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ getActiveLoyaltyProgram()                                   │    │
│  │  • Check if restaurant has loyalty program                  │    │
│  └────────────────────┬───────────────────────────────────────┘    │
│                       ▼                                              │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ generateUniqueBookingReference()                            │    │
│  │  • Loop (max 5 attempts):                                   │    │
│  │    • Generate random reference (e.g., "AB1234")             │    │
│  │    • Try to INSERT booking                                  │    │
│  │    • If unique constraint violation, retry                  │    │
│  └────────────────────┬───────────────────────────────────────┘    │
│                       ▼                                              │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ insertBookingRecord()                                       │    │
│  │  • INSERT INTO bookings (...)                               │    │
│  │  • Returns BookingRecord                                    │    │
│  └────────────────────┬───────────────────────────────────────┘    │
│                       ▼                                              │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ calculateLoyaltyAward() & applyLoyaltyAward()               │    │
│  │  • points = points_per_guest * party_size                   │    │
│  │  • INSERT INTO loyalty_transactions                         │    │
│  │  • UPDATE bookings SET loyalty_points_awarded               │    │
│  └────────────────────┬───────────────────────────────────────┘    │
│                       ▼                                              │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ logAuditEvent()                                             │    │
│  │  • action: "booking.created"                                │    │
│  │  • metadata: { before: null, after: booking }               │    │
│  │  • INSERT INTO audit_events                                 │    │
│  └────────────────────┬───────────────────────────────────────┘    │
│                       ▼                                              │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ fetchBookingsForContact()                                   │    │
│  │  • SELECT all bookings for this customer (email + phone)    │    │
│  └────────────────────┬───────────────────────────────────────┘    │
│                       ▼                                              │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ enqueueBookingCreatedSideEffects()                          │    │
│  │  • Trigger Inngest job: booking.created.side-effects       │    │
│  │  • Payload: { booking, idempotencyKey, restaurantId }       │    │
│  └────────────────────────────────────────────────────────────┘    │
└───────────────────────────────┬──────────────────────────────────────┘
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│                       Background Jobs (Inngest)                      │
│  • Send confirmation email (Resend)                                  │
│  • Record analytics event                                            │
│  • Trigger webhooks (if configured)                                  │
└──────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│                          Response to Client                          │
│  {                                                                   │
│    booking: { id, reference, ... },                                 │
│    loyaltyPointsAwarded: 8,                                          │
│    bookings: [ ... all customer bookings ... ],                      │
│    clientRequestId: "uuid",                                          │
│    idempotencyKey: "uuid",                                           │
│    duplicate: false                                                  │
│  }                                                                   │
└──────────────────────────────────────────────────────────────────────┘
```

### C. Authentication Flow Diagram (Magic Link)

```
┌─────────────┐
│   User      │
│  (Browser)  │
└──────┬──────┘
       │ 1. Navigate to /signin
       ▼
┌──────────────────┐
│ /signin page     │
│  • Email input   │
│  • Submit button │
└──────┬───────────┘
       │ 2. Enter email & submit
       │    POST to Supabase Auth API
       │    (magic link request)
       ▼
┌──────────────────────────────┐
│   Supabase Auth Service      │
│  • Validate email            │
│  • Generate one-time code    │
│  • Store code (expires 1hr)  │
│  • Send magic link email     │
└──────┬───────────────────────┘
       │ 3. Email sent
       ▼
┌──────────────────────────────┐
│   User's Email Inbox         │
│  "Click to sign in:          │
│   https://app.com/api/auth/  │
│   callback?code=XXXXX&       │
│   redirectedFrom=/my-bookings"│
└──────┬───────────────────────┘
       │ 4. User clicks link
       ▼
┌──────────────────────────────┐
│  Next.js Middleware          │
│  • Matches /api/auth/callback│
│  • Refreshes session (no-op) │
│  • Adds API version headers  │
└──────┬───────────────────────┘
       │ 5. Forward to route handler
       ▼
┌──────────────────────────────┐
│ GET /api/auth/callback       │
│  1. Extract 'code' param     │
│  2. Call Supabase:           │
│     exchangeCodeForSession() │
│  3. Supabase validates code  │
│  4. Creates session          │
│  5. Sets HTTP-only cookies:  │
│     • sb-access-token        │
│     • sb-refresh-token       │
│  6. Redirect to:             │
│     ?redirectedFrom OR       │
│     config.auth.callbackUrl  │
└──────┬───────────────────────┘
       │ 6. Redirect
       ▼
┌──────────────────────────────┐
│  Next.js Middleware          │
│  (on /my-bookings request)   │
│  • getSession() from cookies │
│  • Session exists ✓          │
│  • Allow request             │
└──────┬───────────────────────┘
       │ 7. Render page
       ▼
┌──────────────────────────────┐
│  /my-bookings page           │
│  • getUser() from session    │
│  • Fetch user's bookings     │
│  • Display booking list      │
└──────────────────────────────┘
       │ 8. Displayed to user
       ▼
┌─────────────┐
│   User      │
│  (Logged in)│
└─────────────┘
```

---

## 16. API Documentation (Selected Endpoints)

### POST /api/bookings

Create a new booking (customer-facing).

**Authentication**: None (public endpoint)

**Rate Limit**: None for creation, but guest lookup has 20/minute limit

**Request**:

```http
POST /api/bookings HTTP/1.1
Host: app.example.com
Content-Type: application/json
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
User-Agent: Mozilla/5.0 ...

{
  "restaurantId": "39cb1346-20fb-4fa2-b163-0230e1caf749",
  "date": "2025-01-25",
  "time": "19:00",
  "party": 4,
  "bookingType": "dinner",
  "seating": "indoor",
  "notes": "Window table preferred",
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "marketingOptIn": true
}
```

**Response** (201 Created):

```json
{
  "booking": {
    "id": "uuid",
    "restaurant_id": "39cb1346-20fb-4fa2-b163-0230e1caf749",
    "customer_id": "customer-uuid",
    "booking_date": "2025-01-25",
    "start_time": "19:00",
    "end_time": "21:00",
    "start_at": "2025-01-25T19:00:00+00:00",
    "end_at": "2025-01-25T21:00:00+00:00",
    "reference": "AB1234",
    "party_size": 4,
    "booking_type": "dinner",
    "seating_preference": "indoor",
    "status": "confirmed",
    "customer_name": "John Doe",
    "customer_email": "john@example.com",
    "customer_phone": "+1234567890",
    "notes": "Window table preferred",
    "marketing_opt_in": true,
    "loyalty_points_awarded": 8,
    "source": "api",
    "client_request_id": "550e8400-e29b-41d4-a716-446655440000",
    "idempotency_key": "550e8400-e29b-41d4-a716-446655440000",
    "created_at": "2025-01-15T10:30:00Z",
    "updated_at": "2025-01-15T10:30:00Z",
    "details": {
      "channel": "api.bookings",
      "request": {
        "idempotency_key": "550e8400-e29b-41d4-a716-446655440000",
        "client_request_id": "550e8400-e29b-41d4-a716-446655440000",
        "user_agent": "Mozilla/5.0 ..."
      }
    }
  },
  "loyaltyPointsAwarded": 8,
  "bookings": [
    /* Array of all bookings for this customer */
  ],
  "clientRequestId": "550e8400-e29b-41d4-a716-446655440000",
  "idempotencyKey": "550e8400-e29b-41d4-a716-446655440000",
  "duplicate": false
}
```

**Business Logic**:

1. Validates booking time against restaurant operating hours
2. Infers meal type from time if not "drinks"
3. Calculates end time (+2 hours for lunch/dinner, +1.5 for breakfast, +1 for drinks)
4. Creates or updates customer record
5. Checks idempotency key to prevent duplicates
6. Generates unique 6-character reference
7. Awards loyalty points if program active
8. Logs audit event
9. Triggers background job for email confirmation

**Side Effects**:

- Customer record created/updated in `customers` table
- Loyalty transaction created if applicable
- Audit event logged to `audit_events`
- Background job queued for:
  - Email confirmation sent
  - Analytics event recorded
  - Webhooks triggered

**Error Responses**:

- **400 Bad Request**: Invalid payload (Zod validation failed)
  ```json
  {
    "error": "Invalid payload",
    "details": {
      "fieldErrors": {
        "date": ["Invalid date format"],
        "email": ["Invalid email"]
      }
    }
  }
  ```
- **400 Bad Request**: Outside operating hours
  ```json
  {
    "error": "Booking time is outside restaurant operating hours"
  }
  ```
- **409 Conflict**: Idempotency key conflict with different payload
  ```json
  {
    "error": "This update was already applied with different details. Refresh and try again with a new request."
  }
  ```
- **500 Internal Server Error**: Unexpected error
  ```json
  {
    "error": "Unable to create booking"
  }
  ```

---

### GET /api/bookings?me=1

Retrieve authenticated user's bookings.

**Authentication**: Required (Supabase session cookie)

**Authorization**: User can only see their own bookings

**Query Parameters**:
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| me | literal("1") | Yes | - | Flag to indicate "my bookings" |
| restaurantId | uuid | No | All | Filter by restaurant |
| status | enum | No | All | Filter by status (pending, confirmed, cancelled, active) |
| from | ISO-8601 | No | - | Start date (inclusive) |
| to | ISO-8601 | No | - | End date (exclusive) |
| sort | asc\|desc | No | asc | Sort direction by start_at |
| page | integer | No | 1 | Page number (1-indexed) |
| pageSize | integer | No | 10 | Items per page (max 50) |

**Request**:

```http
GET /api/bookings?me=1&status=active&page=1&pageSize=10 HTTP/1.1
Host: app.example.com
Cookie: sb-access-token=...; sb-refresh-token=...
```

**Response** (200 OK):

```json
{
  "items": [
    {
      "id": "booking-uuid",
      "restaurantName": "The Fancy Restaurant",
      "partySize": 4,
      "startIso": "2025-01-25T19:00:00Z",
      "endIso": "2025-01-25T21:00:00Z",
      "status": "confirmed",
      "notes": "Window table preferred",
      "customerName": null,
      "customerEmail": null
    }
  ],
  "pageInfo": {
    "page": 1,
    "pageSize": 10,
    "total": 1,
    "hasNext": false
  }
}
```

**Error Responses**:

- **401 Unauthorized**: No valid session
- **400 Bad Request**: Invalid query parameters

---

### POST /api/ops/bookings

Create a walk-in booking (staff operations console).

**Authentication**: Required (Supabase session)

**Authorization**: Must have team membership for the restaurant

**Rate Limit**: 60 requests per minute per user per restaurant

**Request**:

```http
POST /api/ops/bookings HTTP/1.1
Host: app.example.com
Content-Type: application/json
Cookie: sb-access-token=...; sb-refresh-token=...
Idempotency-Key: 7c9e6679-7425-40de-944b-e07fc1f90ae7

{
  "restaurantId": "39cb1346-20fb-4fa2-b163-0230e1caf749",
  "date": "2025-01-15",
  "time": "20:00",
  "party": 2,
  "bookingType": "dinner",
  "seating": "any",
  "name": "Walk-in Customer",
  "email": null,
  "phone": null,
  "notes": "Walk-in, no contact provided",
  "marketingOptIn": false
}
```

**Response** (201 Created):

```json
{
  "booking": {
    "id": "booking-uuid",
    "restaurant_id": "39cb1346-20fb-4fa2-b163-0230e1caf749",
    "customer_id": "customer-uuid",
    "reference": "CD5678",
    "customer_email": "walkin+7c9e6679742540de944be07fc1f90ae7@system.local",
    "customer_phone": "000-7c9e6679742540de944be07fc1f90ae7",
    "details": {
      "channel": "ops.walkin",
      "staff": {
        "id": "staff-user-uuid",
        "email": "staff@restaurant.com"
      },
      "provided_contact": {
        "email": false,
        "phone": false,
        "email_value": null,
        "phone_value": null
      }
    }
    /* ... other booking fields ... */
  },
  "bookings": [
    /* ... */
  ],
  "idempotencyKey": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "clientRequestId": "7c9e6679-7425-40de-944b-e07fc1f90ae7"
}
```

**Business Logic**:

1. Verifies staff membership for restaurant
2. If email/phone not provided, generates fallback:
   - Email: `walkin+<client_request_id>@system.local`
   - Phone: `000-<client_request_id>`
3. Records staff who created booking in `details.staff`
4. Flags whether real contact info was provided in `details.provided_contact`

**Error Responses**:

- **401 Unauthorized**: No session
- **403 Forbidden**: Not a team member for this restaurant
- **429 Too Many Requests**: Rate limit exceeded

  ```http
  HTTP/1.1 429 Too Many Requests
  Retry-After: 42

  {
    "error": "Too many requests",
    "code": "RATE_LIMITED",
    "retryAfter": 42
  }
  ```

---

### GET /api/restaurants

List all restaurants with optional filters.

**Authentication**: None (public endpoint)

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| search | string | No | Free text search on name/description |
| timezone | string | No | Filter by timezone |
| minCapacity | integer | No | Minimum seating capacity |

**Request**:

```http
GET /api/restaurants?search=pizza&minCapacity=20 HTTP/1.1
Host: app.example.com
```

**Response** (200 OK):

```json
{
  "data": [
    {
      "id": "restaurant-uuid",
      "name": "Pizza Palace",
      "slug": "pizza-palace",
      "timezone": "America/New_York",
      "capacity": 50,
      "address": "123 Main St, New York, NY",
      "phone": "+1234567890",
      "email": "info@pizzapalace.com",
      "website": "https://pizzapalace.com",
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

**Error Responses**:

- **400 Bad Request**: Invalid filter parameters
- **502 Bad Gateway**: Database connection error

---

## 17. Summary & Quick Reference

### Total Route Count

- **Page Routes**: 28
- **API Routes**: 49 (excluding v1 re-exports)
- **Total**: 77 routes

### Route Breakdown by Category

| Category          | Count | Authentication            |
| ----------------- | ----- | ------------------------- |
| Public Pages      | 19    | None                      |
| Protected Pages   | 3     | User session required     |
| Ops Console Pages | 7     | Staff membership required |
| Public API        | 8     | None                      |
| User API          | 4     | User session required     |
| Ops API           | 16    | Staff membership required |
| Owner API         | 7     | Owner/membership required |
| Webhook API       | 1     | Signature verification    |
| Background Jobs   | 1     | Inngest auth              |
| Test/Dev API      | 9     | Development only          |

### Authentication Summary

| Level   | Routes | Verification Method       |
| ------- | ------ | ------------------------- |
| Public  | 27     | None                      |
| User    | 7      | Supabase session cookie   |
| Staff   | 23     | Session + team membership |
| Owner   | 7      | Session + ownership check |
| Webhook | 1      | Signature validation      |
| Dev     | 9      | Environment check         |

### Most Critical Paths

#### Customer Booking Flow

```
1. Browse restaurants: GET /api/restaurants
2. View schedule: GET /api/restaurants/[slug]/schedule
3. Create booking: POST /api/bookings
4. Confirm booking: Navigate to /thank-you
5. View bookings: GET /api/bookings?me=1 (authenticated)
```

#### Staff Operations Flow

```
1. Login: /ops/login → POST to Supabase Auth
2. Dashboard: /ops → GET /api/ops/dashboard/summary
3. View bookings: /ops/bookings → GET /api/ops/bookings
4. Create walk-in: POST /api/ops/bookings
5. Update status: PUT /api/ops/bookings/[id]/status
```

#### Team Management Flow

```
1. Send invitation: POST /api/owner/team/invitations
2. Recipient views: GET /api/team/invitations/[token]
3. Accept invitation: POST /api/team/invitations/[token]/accept
4. View team: GET /api/owner/team/memberships
```

### Quick Reference: HTTP Methods by Route

| HTTP Method | Count | Common Uses                         |
| ----------- | ----- | ----------------------------------- |
| GET         | 32    | Fetch data, listings, details       |
| POST        | 21    | Create bookings, leads, invitations |
| PUT         | 7     | Update profiles, bookings, settings |
| DELETE      | 1     | Cancel invitations                  |

### Data Models Quick Reference

| Table                | Primary Use         | Relationships                |
| -------------------- | ------------------- | ---------------------------- |
| bookings             | Reservation records | → restaurants, customers     |
| customers            | Customer profiles   | → restaurants                |
| restaurants          | Restaurant details  | ← bookings, team_memberships |
| team_memberships     | Staff access        | → restaurants, auth.users    |
| team_invitations     | Pending invitations | → restaurants                |
| loyalty_programs     | Loyalty configs     | → restaurants                |
| loyalty_transactions | Points ledger       | → customers, bookings        |
| profiles             | User profiles       | → auth.users                 |
| audit_events         | Audit trail         | Generic (polymorphic)        |

### Security Checklist

- [x] Input validation (Zod schemas)
- [x] SQL injection protection (parameterized queries)
- [x] XSS prevention (React auto-escape, JSON responses)
- [x] CSRF protection (SameSite cookies)
- [x] Rate limiting (Upstash Redis)
- [x] Authentication (Supabase Auth)
- [x] Authorization (RLS, membership checks)
- [x] Audit logging (audit_events table)
- [x] Idempotency (duplicate prevention)
- [x] Secrets management (environment variables)

### Performance Optimization Checklist

- [x] Database indexes (on frequently queried columns)
- [x] Pagination (all list endpoints)
- [x] Computed columns (start_at, end_at)
- [x] Connection pooling (Supabase client singleton)
- [x] Async background jobs (Inngest)
- [ ] Response caching (not currently implemented)
- [ ] CDN for static assets (configured in Next.js)
- [ ] Image optimization (Next.js Image component)

### Common Error Codes

| Code                     | Status | Meaning                       |
| ------------------------ | ------ | ----------------------------- |
| UNAUTHENTICATED          | 401    | No valid session              |
| FORBIDDEN                | 403    | Insufficient permissions      |
| INVALID_PAYLOAD          | 400    | Validation failed             |
| RATE_LIMITED             | 429    | Too many requests             |
| IDEMPOTENCY_KEY_CONFLICT | 409    | Duplicate with different data |
| EMAIL_IMMUTABLE          | 400    | Cannot change email           |
| UNEXPECTED_ERROR         | 500    | Unhandled exception           |

### Environment Variables Required

**Production**:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `RESEND_FROM`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `INNGEST_EVENT_KEY`
- `INNGEST_SIGNING_KEY`

**Optional**:

- `MAILGUN_API_KEY` (legacy)
- `NEXT_PUBLIC_DEFAULT_RESTAURANT_ID`
- `NEXT_PUBLIC_DEFAULT_RESTAURANT_SLUG`

---

## 18. Code Quality Observations

### Strengths

1. **Type Safety**: Extensive use of TypeScript and Zod for runtime validation
2. **Consistent Patterns**: All API routes follow similar structure (validation → auth → business logic → response)
3. **Error Handling**: Structured error responses with codes and details
4. **Separation of Concerns**: Clear separation between routes, server logic, and database operations
5. **Idempotency**: Built into mutation endpoints to prevent duplicate operations
6. **Audit Trail**: Comprehensive logging of booking lifecycle events
7. **Security**: Multiple layers (input validation, rate limiting, authentication, authorization)

### Areas for Improvement

1. **API Versioning**: `/api/v1/*` routes are simple re-exports, not true versioning
   - Recommendation: Implement proper versioning with separate logic if needed

2. **Rate Limit Fallback**: In-memory rate limiting not suitable for multi-instance production
   - Recommendation: Make Upstash Redis required in production

3. **Test Coverage Gaps** (from system reminder):
   - Customer marketing pages: `/create`, `/checkout`, `/thank-you` (no e2e tests)
   - Direct restaurant item entry: `/item/[slug]` (no e2e coverage)
   - Payments placeholder: `tests/e2e/payments/` is empty

4. **Missing Error Scenarios**:
   - Double-booking prevention (same time slot)
   - Capacity overflow detection
   - Overbooking alerts

5. **Documentation**:
   - API endpoints lack OpenAPI/Swagger documentation
   - Some business logic embedded in route handlers (could be extracted to server layer)

### Deprecation Management

- **Unversioned API Routes**: Currently adding deprecation headers with 30-day sunset
- **Migration Path**: Redirect to `/api/v1/*` equivalents
- **Risk**: Clients may not notice deprecation headers
- **Recommendation**: Add monitoring for unversioned API usage and proactive client migration

### Testing Status

**E2E Tests** (Playwright):

- Ops console: Booking management, team management, walk-in booking, restaurant settings
- Invitations: Team invitation flow
- Marketing: (limited coverage)
- Payments: (empty - placeholder)

**Missing Coverage**:

- Customer booking flow end-to-end
- Checkout and payment processing
- Restaurant item direct booking

---

## 19. Documentation Gaps Identified

### Undocumented Routes

All routes are cataloged in this document, but the repository lacks:

1. **OpenAPI Specification**: No `openapi.yaml` actively maintained (file exists but may be outdated)
2. **JSDoc Comments**: Limited inline API documentation
3. **Postman Collection**: No pre-built API testing collection
4. **README for API**: No dedicated API documentation in `/docs`

### Recommendations

1. **Generate OpenAPI Spec**: Use tools like `tsoa` or manually maintain `openapi.yaml`
2. **Add JSDoc**: Document all API route handlers with parameters and return types
3. **Create Examples**: Add example requests/responses in `/docs/api-examples/`
4. **Add Architecture Diagrams**: This document includes ASCII diagrams; consider using Mermaid or similar for versioned diagrams

---

## 20. Final Notes

### Migration from ShipFast Template

This application appears to be built from the ShipFast Next.js boilerplate:

- Evidence: `config.ts` has `appName: "ShipFast"`, `domainName: "shipfa.st"`
- Recommendation: Update branding throughout codebase

### Next Steps for Development

1. **Complete Payment Integration**: `tests/e2e/payments/` is empty
2. **Add E2E Coverage**: `/create`, `/checkout`, `/thank-you`, `/item/[slug]` flows
3. **Implement Capacity Management**: Prevent overbooking
4. **Add SMS Notifications**: Placeholder exists in job handlers
5. **Create Admin Dashboard**: Full analytics and reporting UI
6. **Multi-Restaurant Support**: Enhance staff UI for managing multiple locations

### Contributing Guidelines

Refer to `AGENTS.md` for:

- Task structure (research → plan → implement → verify)
- Coding conventions
- Mobile-first design principles
- Accessibility requirements
- Supabase remote-only policy

---

**End of Comprehensive Route Analysis**

Generated: 2025-01-15  
Document Version: 1.0  
Repository: SajiloReserveX  
Framework: Next.js 15.5.4 (App Router)

---

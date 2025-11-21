# SajiloReserveX Routing Conventions

## Overview

This document defines the standardized routing conventions used across SajiloReserveX to ensure consistency, discoverability, and maintainability of the application's API and page routes.

## Table of Contents

1. [API Routes](#api-routes)
2. [Page Routes](#page-routes)
3. [Route Parameters](#route-parameters)
4. [Authorization Patterns](#authorization-patterns)
5. [HTTP Methods](#http-methods)
6. [Naming Conventions](#naming-conventions)

---

## API Routes

### Route Organization

All API routes follow a hierarchical structure under `/src/app/api/`. Routes are organized by domain/feature:

```
/src/app/api/
├── bookings/              # Guest-facing booking endpoints
├── restaurants/           # Public restaurant information
├── availability/          # Availability checking
├── profile/              # User profile management
├── team/                 # Team member invitations
├── ops/                  # Operations/staff management
│   ├── bookings/         # Staff booking management
│   ├── restaurants/      # Restaurant management
│   ├── tables/           # Table management
│   ├── zones/            # Zone management
│   ├── dashboard/        # Analytics dashboards
│   ├── customers/        # Customer management
│   ├── team/             # Team management
│   ├── occasions/        # Occasion settings
│   ├── allowed-capacities/  # Capacity configuration
│   ├── settings/         # Configuration
│   └── strategies/       # Seating strategies
├── test/                 # Testing endpoints (e2e, playwright)
├── staff/                # Internal staff operations
└── config/               # Public configuration
```

### Route Structure

API routes follow this pattern:

```
/api/{domain}/{resource}/{[id]}/{action}
```

**Examples:**

- `GET /api/bookings` - List bookings
- `POST /api/bookings` - Create booking
- `GET /api/bookings/[id]` - Get booking details
- `PUT /api/bookings/[id]` - Update booking
- `DELETE /api/bookings/[id]` - Delete booking
- `POST /api/ops/bookings/[id]/check-in` - Check-in action

### Versioning

**All v1 API endpoints have been consolidated to base `/api/*` routes.**

- No longer use `/api/v1/*` paths
- Single source of truth for each endpoint
- Version management handled through feature flags and gradual migrations

---

## Page Routes

### Route Organization

Page routes in Next.js 13+ use the app directory structure with file-based routing:

```
/src/app/
├── guest/                # Guest portal (primary)
│   └── (guest)/
│       ├── (guest-experience)/   # Browse, reserve, view bookings
│       ├── (account)/            # Profile, account settings
│       └── (marketing)/          # Product info, policies
├── app/                  # Operations dashboard
│   └── (app)/
│       ├── bookings/     # Booking management
│       ├── customers/    # Customer list
│       ├── seating/      # Floor plan, tables, zones
│       ├── analytics/    # Analytics dashboards
│       ├── settings/     # Restaurant settings
│       ├── management/   # Team management
│       └── login/        # Operations login
├── auth/                 # Authentication pages
│   └── signin/
├── account/              # Legacy account routes (consider migrating to /guest)
├── bookings/             # Legacy booking routes (consider migrating to /guest)
├── restaurants/          # Restaurant browsing
├── contact/              # Contact page
├── privacy-policy/       # Privacy policy
├── product/              # Product information
├── terms/                # Terms of service
└── walk-in/              # Walk-in booking
```

### Route Groups

Uses Next.js route groups (parentheses) for organization without affecting URLs:

- `(guest-experience)` - Guest browsing and reservation experience
- `(account)` - User account and profile management
- `(marketing)` - Marketing and informational pages
- `(app)` - Operations dashboard features
- `(restaurant-partners)` - Restaurant partner pages

---

## Route Parameters

### Parameter Naming Conventions

Use **lowercase, descriptive names** in square brackets:

| Parameter | Usage                             | Type   | Example                     |
| --------- | --------------------------------- | ------ | --------------------------- |
| `[id]`    | Generic resource ID               | UUID   | `/bookings/[id]`            |
| `[slug]`  | URL-friendly identifier           | string | `/restaurants/[slug]`       |
| `[token]` | Authentication/verification token | string | `/team/invitations/[token]` |

### Standard Resource Parameters

```
[id]              - Primary resource identifier (UUID)
[slug]            - URL-friendly name (restaurants, items)
[token]           - Secure token (invitations, confirmations)
```

**Do NOT use:**

- `[reservationId]` → use `[id]` instead
- `[inviteId]` → use `[id]` instead
- `[tableId]` → use `[id]` in nested context (parent provides distinction)
- `[userId]` → use `[id]` or pass via auth context

### Nested Resources

For nested resources, use generic `[id]` at each level:

```
✓ /api/bookings/[id]/tables/[id]
✓ /api/ops/restaurants/[id]/details

✗ /api/bookings/[bookingId]/tables/[tableId]
✗ /api/bookings/[id]/reservations/[reservationId]
```

---

## Authorization Patterns

### Route-Level Access Control

Authorization is **NOT** enforced at the route level through path structure. Instead:

1. **Single endpoint path** regardless of role
2. **Runtime authorization checks** via middleware and service functions
3. **Feature-based access** through `requireMembership()`, `requireAdminMembership()`, etc.

### Public vs Protected Routes

**Public routes** (no auth required):

- `/api/bookings` - POST (create new booking)
- `/api/restaurants` - GET (list restaurants)
- `/api/availability` - GET (check availability)

**Protected routes** (auth required):

- `/api/ops/*` - All operations routes
- `/api/profile` - User profile
- `/api/team/invitations` - Team management

**Guest routes** (authenticated guests):

- `/guest/...` - Guest portal
- `/guest/bookings/...` - Guest booking access

---

## HTTP Methods

### Standard CRUD Operations

```
GET    /api/resource         - List/retrieve resources
POST   /api/resource         - Create new resource
PUT    /api/resource/[id]    - Full update
PATCH  /api/resource/[id]    - Partial update
DELETE /api/resource/[id]    - Delete resource
```

### Action Endpoints

For non-CRUD operations, use descriptive action names:

```
POST   /api/ops/bookings/[id]/check-in          - Action: Check in
POST   /api/ops/bookings/[id]/check-out         - Action: Check out
POST   /api/ops/bookings/[id]/assign-tables    - Action: Assign tables
DELETE /api/ops/bookings/[id]/tables/[id]      - Action: Unassign table
POST   /api/ops/bookings/[id]/no-show          - Action: Mark no-show
PATCH  /api/ops/bookings/[id]/status           - Action: Update status
```

### Query Parameters

Use query parameters for filtering, pagination, and sorting:

```
GET /api/bookings?email=user@example.com&phone=07123456789
GET /api/bookings?me=1&page=1&pageSize=10&sort=asc&status=confirmed
GET /api/ops/bookings?restaurantId=uuid&from=2024-01-01&to=2024-12-31
```

---

## Naming Conventions

### Route Names

- **Plural for collections:** `/api/bookings`, `/api/restaurants`
- **Singular for actions:** `/check-in`, `/assign-tables`
- **Use hyphens for multi-word paths:** `/api/floor-plan`, `/api/table-assignments`
- **Lowercase only:** Never use camelCase or PascalCase in URLs

### File Structure

```
✓ /api/ops/bookings/[id]/check-in/route.ts
✓ /api/restaurants/[slug]/schedule/route.ts
✓ /app/seating/floor-plan/page.tsx

✗ /api/ops/bookings/[id]/checkIn/route.ts
✗ /api/restaurants/[slug]/Schedule/route.ts
✗ /app/seating/floorPlan/page.tsx
```

### Type Safety

Use TypeScript for route context and parameters:

```typescript
type RouteParams = {
  params: Promise<{ id: string | string[] }>;
};

type RouteContext = {
  params: Promise<{ restaurantId: string; tableId: string }>;
  searchParams: Promise<Record<string, string | string[]>>;
};
```

---

## Common Patterns

### Authentication Flow

```
POST   /api/team/invitations/[token]/accept   - Accept invitation
GET    /auth/signin                            - Sign in page
POST   /api/auth/callback                      - OAuth callback
```

### Resource Operations

```
// Create
POST /api/bookings
→ Returns: { booking, confirmationToken, loyaltyPointsAwarded, clientRequestId }

// Retrieve
GET /api/bookings/[id]
GET /api/ops/bookings?filters...
→ Returns: { items: Booking[], pageInfo: PageInfo }

// Update
PATCH /api/ops/bookings/[id]/status
PUT /api/ops/restaurants/[id]/details
→ Returns: Updated resource

// Delete
DELETE /api/ops/bookings/[id]
DELETE /api/ops/bookings/[id]/tables/[id]
→ Returns: { success: true } or error
```

### Pagination

Use these standard query parameters:

```
page=1              - Page number (1-indexed)
pageSize=10         - Items per page
sort=asc|desc       - Sort direction
offset=0            - Starting position (alternative to page)
limit=10            - Maximum items (alternative to pageSize)
```

Response format:

```typescript
{
  items: T[];
  pageInfo: {
    page: number;
    pageSize: number;
    total: number;
    hasNext: boolean;
  }
}
```

---

## Migration Guide

### From Old Routes

If you encounter old route patterns, migrate as follows:

| Old                     | New                                   | Notes                          |
| ----------------------- | ------------------------------------- | ------------------------------ |
| `/api/v1/*`             | `/api/*`                              | Consolidated in latest version |
| `/api/owner/*`          | `/api/ops/*`                          | Owner routes now use ops       |
| `/api/internal/test/*`  | `/api/test/*`                         | Test routes consolidated       |
| `/(guest-experience)/*` | `/guest/(guest)/(guest-experience)/*` | Moved to guest portal          |
| `[reservationId]`       | `[id]`                                | Standardized parameter naming  |
| `[inviteId]`            | `[id]`                                | Standardized parameter naming  |

---

## Testing Routes

All testing endpoints are consolidated under `/api/test/`:

```
POST   /api/test/bookings                              - Create test booking
POST   /api/test/invitations                           - Create test invitation
DELETE /api/test/invitations                           - Delete test invitation
POST   /api/test/playwright-session                    - Create playwright session
POST   /api/test/leads                                 - Create test lead
DELETE /api/test/leads                                 - Delete test leads
GET    /api/test/reservations/[id]/confirmation       - Get test confirmation
```

Guard: Protected by `guardTestEndpoint()` - only available in development/test environments.

---

## Best Practices

### Do

✓ Use descriptive, lowercase route names
✓ Organize routes by domain/feature
✓ Use `[id]` consistently for resource identifiers
✓ Keep action endpoints as POST or PATCH
✓ Use pagination for list endpoints
✓ Include proper error responses
✓ Document breaking changes
✓ Use feature flags for gradual migrations

### Don't

✗ Create version-specific routes (`/v1`, `/v2`)
✗ Use camelCase or PascalCase in URLs
✗ Nest routes more than 3-4 levels deep
✗ Create authorization-based route variations
✗ Use inconsistent parameter naming
✗ Create routes for every minor version change
✗ Leave orphaned or deprecated routes in production

---

## Examples

### Complete API Endpoint

```typescript
// /api/ops/bookings/[id]/check-in/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';

type RouteParams = {
  params: Promise<{ id: string }>;
};

const checkInSchema = z.object({
  notes: z.string().optional(),
});

export async function POST(req: NextRequest, context: RouteParams) {
  const { id } = await context.params;

  // Validate
  const body = await req.json();
  const parsed = checkInSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid payload', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Authenticate
  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Authorize
  const { data: booking } = await supabase
    .from('bookings')
    .select('restaurant_id')
    .eq('id', id)
    .single();

  await requireMembershipForRestaurant({
    userId: user.id,
    restaurantId: booking.restaurant_id,
  });

  // Execute
  try {
    const result = await performCheckIn(id, parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[ops][bookings][check-in]', error);
    return NextResponse.json({ error: 'Failed to check in' }, { status: 500 });
  }
}
```

### Complete Page Route

```
/src/app/guest/(guest)/(guest-experience)/restaurants/[slug]/page.tsx
├── Route: /restaurants/[slug] (within guest portal)
├── Auth: Guest (public or authenticated)
├── Layout: Applied from parent (guest-experience)
└── Components: RestaurantDetail, ReservationWidget
```

---

## Questions & Support

For routing-related questions or to suggest improvements to these conventions:

1. Check existing patterns in the codebase
2. Refer to this document
3. Open an issue with the `routing` label
4. Propose changes via pull request with documentation updates

---

**Last Updated:** November 21, 2024
**Version:** 2.0
**Status:** Active

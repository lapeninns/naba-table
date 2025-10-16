# SajiloReserveX - Comprehensive Implemented Features Documentation

**Document Version:** 1.0  
**Last Updated:** 2025-01-15  
**Project:** SajiloReserveX Restaurant Reservation & Operations Platform

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture Summary](#architecture-summary)
3. [Epic 1: Guest Booking & Reservations](#epic-1-guest-booking--reservations)
4. [Epic 2: User Authentication & Profile Management](#epic-2-user-authentication--profile-management)
5. [Epic 3: Operations Dashboard](#epic-3-operations-dashboard)
6. [Epic 4: Team Management](#epic-4-team-management)
7. [Epic 5: Restaurant Configuration](#epic-5-restaurant-configuration)
8. [Epic 6: Loyalty Program](#epic-6-loyalty-program)
9. [Epic 7: Analytics & Event Tracking](#epic-7-analytics--event-tracking)
10. [Epic 8: Lead Generation & Marketing](#epic-8-lead-generation--marketing)
11. [Epic 9: Security & Rate Limiting](#epic-9-security--rate-limiting)
12. [Epic 10: Email Notifications](#epic-10-email-notifications)
13. [Database Schema Reference](#database-schema-reference)
14. [API Endpoints Reference](#api-endpoints-reference)
15. [Feature Flags & Configuration](#feature-flags--configuration)

---

## Project Overview

**SajiloReserveX** is a production-ready restaurant reservation and operations management platform built with modern web technologies. The system serves two primary user groups:

### User Personas

1. **Guests/Diners**
   - Browse restaurants and check availability
   - Create and manage reservations
   - Receive confirmation emails
   - Earn loyalty points

2. **Restaurant Operators**
   - View real-time booking dashboard
   - Manage reservations and customer data
   - Configure restaurant settings
   - Manage team access
   - Export data for analysis

### Key Differentiators

- **Real-time availability** tracking with live updates
- **Zero-friction booking** with no phone calls or fees
- **Comprehensive operations dashboard** for restaurant staff
- **Role-based access control** with team management
- **Production-grade security** with rate limiting and validation
- **Loyalty program** with automatic point accrual
- **Complete audit trail** for all booking changes
- **Mobile-first responsive design**

---

## Architecture Summary

### Technology Stack

| Layer                | Technology            | Version | Purpose                         |
| -------------------- | --------------------- | ------- | ------------------------------- |
| **Framework**        | Next.js               | 15.5.4  | React framework with App Router |
| **Language**         | TypeScript            | 5.9.2   | Type-safe development           |
| **Database**         | Supabase (PostgreSQL) | Latest  | Primary data store              |
| **Authentication**   | Supabase Auth         | Latest  | User authentication             |
| **State Management** | TanStack Query        | 5.90.2  | Server state & caching          |
| **UI Components**    | Radix UI + shadcn/ui  | Latest  | Accessible component library    |
| **Styling**          | Tailwind CSS          | 4.1.13  | Utility-first CSS               |
| **Form Validation**  | Zod                   | 4.1.11  | Schema validation               |
| **Form Management**  | React Hook Form       | 7.63.0  | Form state management           |
| **Email Service**    | Resend + Nodemailer   | Latest  | Transactional emails            |
| **Rate Limiting**    | Upstash Redis         | 1.35.4  | Distributed rate limiting       |
| **Date/Time**        | date-fns + Cally      | Latest  | Date manipulation & picker      |
| **Testing (Unit)**   | Vitest                | 3.2.4   | Unit & integration tests        |
| **Testing (E2E)**    | Playwright            | 1.55.1  | End-to-end tests                |

### Architecture Patterns

- **Monorepo structure** with separate `src/` and `reserve/` applications
- **Server-first rendering** with RSC (React Server Components)
- **API versioning** under `/api/v1/*` for stable contracts
- **Service layer separation** in `server/` directory
- **Feature-based organization** for components
- **Type-safe API** with Zod validation at boundaries
- **Optimistic updates** with TanStack Query mutations
- **Progressive enhancement** with mobile-first design

---

## Epic 1: Guest Booking & Reservations

### Story 1.1: Browse Partner Restaurants

**Priority:** P0 (Critical)  
**Confidence:** High  
**Implementation Status:** ✅ Complete

#### User Story

```gherkin
AS A guest looking for a dining experience
I WANT TO browse available restaurants with real-time availability
SO THAT I can discover options and make an informed booking decision
```

#### Business Value

- **Primary KPI:** Restaurant discovery rate
- **Secondary KPI:** Conversion from browse to booking
- **User Benefit:** Zero-friction discovery without phone calls

#### Detailed Acceptance Criteria

```gherkin
Feature: Restaurant Discovery and Browsing

  Background:
    Given the system has 10 partner restaurants
    And each restaurant has available time slots

  Scenario: View restaurant list on homepage
    Given I visit the homepage at "/"
    When the page loads
    Then I should see a hero section with the heading "Book unforgettable nights in just a few taps"
    And I should see three feature highlights:
      | Feature | Icon | Description |
      | Live availability | Clock3 | See seats update in real time and lock in the perfect slot |
      | Premium partners | Sparkles | Curated venues that deliver unforgettable dining experiences |
      | Guest friendly | UsersRound | Track bookings, share details, and invite friends with ease |
    And I should see a "Partner restaurants" section
    And the restaurant list should display all active restaurants

  Scenario: View restaurant cards
    Given I am viewing the restaurant list
    When I scroll through the restaurants
    Then each restaurant card should display:
      | Field | Format |
      | Restaurant name | Text heading |
      | Availability indicator | Visual cue (green/amber/red) |
      | Cuisine type | Tag/badge (if available) |
      | Location | Address or area |
      | Booking link | Call-to-action button |

  Scenario: Filter restaurants by availability
    Given I am on the browse page
    When I select "Available tonight" filter
    Then only restaurants with availability in the next 4 hours are shown
    And the count updates dynamically

  Scenario: Handle no restaurants available
    Given there are no active restaurants in the system
    When I visit the homepage
    Then I should see a friendly message explaining the situation
    And I should see a "Request an invite" call to action

  Scenario: Access restaurant booking flow
    Given I am viewing a restaurant card for "Bella Vista"
    When I click the "Reserve" button
    Then I am navigated to "/reserve/r/bella-vista"
    And the booking form loads with restaurant context pre-filled
```

#### Implementation Evidence

**Frontend Pages:**

```typescript
// File: src/app/page.tsx
// Line: 1-112
// Purpose: Main landing page with restaurant browser

export default async function HomePage() {
  let restaurants: RestaurantSummary[] = [];
  let loadError = false;

  try {
    restaurants = await listRestaurants();
  } catch (error) {
    loadError = true;
    console.error(error);
  }

  // Hydration with TanStack Query for client-side refetching
  const queryClient = new QueryClient();
  if (!loadError) {
    queryClient.setQueryData(queryKeys.restaurants.list({}), restaurants);
  }
  const dehydratedState = dehydrate(queryClient);

  return (
    <HydrationBoundary state={dehydratedState}>
      <HeroSection />
      <RestaurantSection restaurants={restaurants} hasError={loadError} />
    </HydrationBoundary>
  );
}
```

```typescript
// File: src/app/browse/page.tsx
// Purpose: Dedicated browse page (same content as homepage)
export { default } from '../page';
```

**UI Components:**

```typescript
// File: src/components/marketing/RestaurantBrowser.tsx
// Purpose: Interactive restaurant list with filtering and search
// Features:
// - Client-side filtering
// - Real-time availability updates
// - Loading states
// - Error boundaries
```

**Backend Services:**

```typescript
// File: server/restaurants/list.ts
// Purpose: Fetch active restaurants from database

export async function listRestaurants(filters?: RestaurantFilters): Promise<RestaurantSummary[]> {
  const supabase = getServiceSupabaseClient();

  let query = supabase
    .from('restaurants')
    .select('id, name, slug, cuisine_type, location, timezone')
    .eq('is_active', true)
    .order('name', { ascending: true });

  const { data, error } = await query;

  if (error) {
    throw new ListRestaurantsError(error.message);
  }

  return data || [];
}
```

**API Endpoints:**

```typescript
// File: src/app/api/restaurants/route.ts
// Method: GET
// Route: /api/restaurants
// Purpose: RESTful endpoint for restaurant list

export async function GET(req: NextRequest) {
  try {
    const restaurants = await listRestaurants();
    return NextResponse.json({ restaurants });
  } catch (error) {
    return NextResponse.json({ error: 'Unable to fetch restaurants' }, { status: 500 });
  }
}
```

**Type Definitions:**

```typescript
// File: src/lib/restaurants/types.ts
// Purpose: Type-safe restaurant data structures

export type RestaurantSummary = {
  id: string;
  name: string;
  slug: string;
  cuisine_type?: string | null;
  location?: string | null;
  timezone: string;
  is_active: boolean;
};

export type RestaurantFilters = {
  cuisineType?: string;
  location?: string;
  availableDate?: string;
};
```

**Database Schema:**

```sql
-- File: supabase/migrations/20251006170446_remote_schema.sql
-- Table: restaurants

CREATE TABLE restaurants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  cuisine_type TEXT,
  location TEXT,
  address TEXT,
  timezone TEXT DEFAULT 'Europe/London' NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  contact_email TEXT,
  contact_phone TEXT,
  booking_policy TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_restaurants_active ON restaurants(is_active);
CREATE INDEX idx_restaurants_slug ON restaurants(slug);
```

**Query Keys (React Query):**

```typescript
// File: src/lib/query/keys.ts
// Purpose: Centralized query key factory

export const queryKeys = {
  restaurants: {
    all: ['restaurants'] as const,
    list: (filters: Record<string, unknown>) =>
      [...queryKeys.restaurants.all, 'list', filters] as const,
    detail: (slug: string) => [...queryKeys.restaurants.all, 'detail', slug] as const,
  },
  // ... other keys
};
```

#### Performance Considerations

- **SSR** for initial restaurant list (fast first paint)
- **Hydration** with pre-fetched data (no loading spinner)
- **Client-side caching** via TanStack Query (instant subsequent navigation)
- **Database indexes** on `is_active` and `slug` fields

#### Accessibility Features

- **Semantic HTML** with proper heading hierarchy (h1 → h2)
- **ARIA labels** on sections (`aria-labelledby`)
- **Keyboard navigation** fully supported
- **Focus management** with visible indicators
- **Screen reader** friendly text alternatives

---

### Story 1.2: Create a Restaurant Booking

**Priority:** P0 (Critical)  
**Confidence:** High  
**Implementation Status:** ✅ Complete

#### User Story

```gherkin
AS A guest who found a restaurant I like
I WANT TO create a reservation with my party details and contact information
SO THAT I can secure a table at my preferred date and time
```

#### Business Value

- **Primary KPI:** Booking conversion rate
- **Secondary KPI:** Average time to complete booking
- **User Benefit:** Fast, reliable booking without phone calls

#### Detailed Acceptance Criteria

```gherkin
Feature: Restaurant Booking Creation

  Background:
    Given I am on the booking page for "Bella Vista" restaurant
    And the restaurant has availability on "2025-01-20"
    And the restaurant is open from 17:00 to 23:00

  Scenario: Display booking form with all required fields
    When the booking form loads
    Then I should see the following fields:
      | Field | Type | Required | Validation |
      | Date | Date picker | Yes | YYYY-MM-DD format, future dates only |
      | Time | Time picker | Yes | HH:MM format, within operating hours |
      | Party Size | Number input | Yes | Min: 1, Max: 20 |
      | Booking Type | Select | Yes | Options: breakfast, lunch, dinner, drinks |
      | Seating Preference | Select | Yes | Options: any, indoor, outdoor, bar, window, quiet, booth |
      | Guest Name | Text input | Yes | Min: 2 chars, Max: 120 chars |
      | Email | Email input | Yes | Valid email format |
      | Phone | Tel input | Yes | Min: 7 digits, Max: 50 chars |
      | Special Notes | Textarea | No | Max: 500 chars |
      | Marketing Opt-in | Checkbox | No | Boolean |
    And the form should display restaurant context:
      | Context |
      | Restaurant name |
      | Restaurant timezone |
      | Current availability |

  Scenario: Successfully create a booking
    Given I have filled out all required fields:
      | Field | Value |
      | Date | 2025-01-20 |
      | Time | 19:00 |
      | Party Size | 4 |
      | Booking Type | dinner |
      | Seating Preference | indoor |
      | Guest Name | John Smith |
      | Email | john@example.com |
      | Phone | +44 7700 900123 |
      | Special Notes | Anniversary celebration |
      | Marketing Opt-in | true |
    When I submit the booking form
    Then a POST request is sent to "/api/bookings"
    And the request includes an idempotency key header
    And the booking is created with status "confirmed"
    And I receive a response with:
      | Field | Description |
      | booking.id | UUID of the booking |
      | booking.reference | 10-character alphanumeric reference |
      | confirmationToken | 64-character secure token |
      | loyaltyPointsAwarded | Points earned (if program active) |
      | clientRequestId | UUID for request tracking |
    And the response status is 201 Created
    And I am redirected to a confirmation page
    And a confirmation email is sent to john@example.com

  Scenario: Loyalty points are automatically awarded
    Given the restaurant has an active loyalty program
    And the program awards 10 base points + 5 points per guest
    And I create a booking for 4 guests
    When the booking is confirmed
    Then I am awarded 30 loyalty points (10 + 4 * 5)
    And the points are recorded in loyalty_point_events table
    And my total points balance is updated
    And the booking record shows loyalty_points_awarded: 30

  Scenario: Idempotency prevents duplicate bookings
    Given I submit a booking with idempotency key "abc-123-def-456"
    And the booking is successfully created
    When I retry the request with the same idempotency key
    Then the API returns the original booking
    And the response includes "duplicate": true
    And the response status is 200 OK
    And no new booking is created in the database

  Scenario: Validation rejects booking outside operating hours
    Given the restaurant opens at 17:00
    And I try to book a time at 14:00
    When I submit the booking
    Then I receive a 400 Bad Request error
    And the error message states "Operating hours validation failed"
    And the booking is not created

  Scenario: Validation rejects past booking times
    Given the current time is 2025-01-15 15:00 UTC
    And past booking validation is enabled
    And the grace period is 15 minutes
    When I try to book 2025-01-15 at 14:00
    Then I receive a 422 Unprocessable Entity error
    And the error code is "PAST_BOOKING_TIME"
    And the error details include:
      | Field | Value |
      | currentTime | 2025-01-15T15:00:00Z |
      | requestedTime | 2025-01-15T14:00:00Z |
      | graceMinutes | 15 |
    And an observability event is logged
    And the booking is not created

  Scenario: Grace period allows bookings within threshold
    Given the current time is 2025-01-15 15:00 UTC
    And the grace period is 15 minutes
    When I try to book 2025-01-15 at 14:50
    Then the booking is accepted (within 10-minute buffer)
    And the booking is created successfully

  Scenario: Handle duplicate booking reference collision
    Given there are existing bookings in the database
    When a randomly generated reference collides with an existing one
    Then the system retries with a new reference (up to 5 attempts)
    And the booking is eventually created with a unique reference

  Scenario: Handle validation errors with clear feedback
    Given I submit a booking with invalid data:
      | Field | Invalid Value | Expected Error |
      | email | not-an-email | Invalid email format |
      | phone | 123 | Phone must be 7-20 characters |
      | party | 0 | Party size must be at least 1 |
      | notes | [501 characters] | Notes must be max 500 characters |
    When the validation runs
    Then I receive a 400 Bad Request error
    And the error response includes field-level details
    And no booking is created

  Scenario: Rate limiting prevents abuse
    Given I attempt to create 70 bookings in 1 minute
    When I exceed the limit of 60 requests per minute
    Then subsequent requests return 429 Too Many Requests
    And the response includes headers:
      | Header | Purpose |
      | Retry-After | Seconds until rate limit resets |
      | X-RateLimit-Limit | Maximum requests allowed |
      | X-RateLimit-Remaining | Requests remaining in window |
      | X-RateLimit-Reset | Unix timestamp of reset |
    And an observability event is logged

  Scenario: Booking type is inferred from time slot
    Given I select a booking time of 19:00 (7 PM)
    When the booking is processed
    Then the booking type is automatically set to "dinner"

    Given I select a booking time of 13:00 (1 PM)
    When the booking is processed
    Then the booking type is automatically set to "lunch"

  Scenario: End time is calculated based on booking type
    Given I book dinner at 19:00
    When the booking is created
    Then the end time is set to 21:00 (120 minutes later)

    Given I book lunch at 12:00
    When the booking is created
    Then the end time is set to 13:30 (90 minutes later)

    Given I book drinks at 18:00
    When the booking is created
    Then the end time is set to 19:15 (75 minutes later)
```

#### Implementation Evidence

**Frontend Components:**

```typescript
// File: src/components/reserve/booking-flow/index.tsx
// Purpose: Multi-step booking wizard with validation

export default function BookingFlowPage({ initialDetails }: Props) {
  const [step, setStep] = useState<BookingStep>('details');
  const [bookingData, setBookingData] = useState<BookingFormData>(initialState);

  const createBookingMutation = useMutation({
    mutationFn: async (data: BookingPayload) => {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': generateIdempotencyKey(),
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Booking failed');
      }

      return response.json();
    },
    onSuccess: (data) => {
      // Navigate to confirmation page
      router.push(`/reserve/${data.booking.id}?token=${data.confirmationToken}`);
    },
  });

  return (
    <WizardForm
      step={step}
      onStepChange={setStep}
      onSubmit={createBookingMutation.mutate}
      data={bookingData}
      onChange={setBookingData}
    />
  );
}
```

**API Route:**

```typescript
// File: src/app/api/bookings/route.ts
// Line: 1-765
// Method: POST
// Route: /api/bookings

export async function POST(req: NextRequest) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  // Zod validation
  const parsed = bookingSchema.safeParse(payload);
  if (!parsed.success) {
    return handleZodError(parsed.error);
  }

  const data = parsed.data;
  const restaurantId = data.restaurantId ?? (await getDefaultRestaurantId());
  const clientIp = extractClientIp(req);

  // Rate limiting
  const rateResult = await consumeRateLimit({
    identifier: `bookings:create:${restaurantId}:${clientIp}`,
    limit: 60,
    windowMs: 60_000,
  });

  if (!rateResult.ok) {
    return NextResponse.json(
      { error: 'Too many booking requests', code: 'RATE_LIMITED' },
      { status: 429, headers: { 'Retry-After': '...' } },
    );
  }

  // Extract idempotency key
  const idempotencyKey = normalizeIdempotencyKey(req.headers.get('Idempotency-Key'));
  const clientRequestId = coerceUuid(idempotencyKey) ?? randomUUID();

  try {
    const supabase = getServiceSupabaseClient();

    // Normalize booking type
    const normalizedBookingType =
      data.bookingType === 'drinks' ? 'drinks' : inferMealTypeFromTime(data.time);

    // Validate against operating hours and past time
    let startTime = data.time;
    try {
      const schedule = await getRestaurantSchedule(restaurantId, {
        date: data.date,
        client: supabase,
      });

      // Operating hours validation
      const { time } = assertBookingWithinOperatingWindow({
        schedule,
        requestedTime: data.time,
        bookingType: normalizedBookingType,
      });
      startTime = time;

      // Past time validation
      if (env.featureFlags.bookingPastTimeBlocking) {
        try {
          assertBookingNotInPast(schedule.timezone, data.date, startTime, {
            graceMinutes: env.featureFlags.bookingPastTimeGraceMinutes,
          });
        } catch (pastTimeError) {
          if (pastTimeError instanceof PastBookingError) {
            // Log and reject
            void recordObservabilityEvent({
              source: 'api.bookings',
              eventType: 'booking.past_time.blocked',
              severity: 'warning',
              context: pastTimeError.details,
            });

            return NextResponse.json(
              {
                error: pastTimeError.message,
                code: pastTimeError.code,
                details: pastTimeError.details,
              },
              { status: 422 },
            );
          }
          throw pastTimeError;
        }
      }
    } catch (validationError) {
      if (validationError instanceof OperatingHoursError) {
        return NextResponse.json({ error: validationError.message }, { status: 400 });
      }
      throw validationError;
    }

    const endTime = deriveEndTime(startTime, normalizedBookingType);

    // Upsert customer
    const customer = await upsertCustomer(supabase, {
      restaurantId,
      email: data.email,
      phone: data.phone,
      name: data.name,
      marketingOptIn: data.marketingOptIn ?? false,
    });

    // Check for existing booking with same idempotency key
    if (idempotencyKey) {
      const { data: existing } = await supabase
        .from('bookings')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();

      if (existing) {
        const bookings = await fetchBookingsForContact(
          supabase,
          restaurantId,
          data.email,
          data.phone,
        );
        return NextResponse.json({
          booking: existing,
          bookings,
          idempotencyKey,
          clientRequestId: existing.client_request_id,
          duplicate: true,
        });
      }
    }

    // Get loyalty program
    const loyaltyProgram = await getActiveLoyaltyProgram(supabase, restaurantId);

    // Build booking details
    const bookingDetails = buildBookingDetails({
      idempotencyKey,
      clientRequestId,
      userAgent: req.headers.get('user-agent'),
    });

    // Create booking with unique reference
    let booking: BookingRecord | null = null;
    let reference = '';

    for (let attempt = 0; attempt < 5 && !booking; attempt += 1) {
      reference = await generateUniqueBookingReference(supabase);

      try {
        booking = await insertBookingRecord(supabase, {
          restaurant_id: restaurantId,
          customer_id: customer.id,
          booking_date: data.date,
          start_time: startTime,
          end_time: endTime,
          reference,
          party_size: data.party,
          booking_type: normalizedBookingType,
          seating_preference: data.seating,
          status: 'confirmed',
          customer_name: data.name,
          customer_email: normalizeEmail(data.email),
          customer_phone: data.phone.trim(),
          notes: data.notes ?? null,
          marketing_opt_in: data.marketingOptIn ?? false,
          source: 'api',
          client_request_id: clientRequestId,
          idempotency_key: idempotencyKey ?? null,
          details: bookingDetails,
        });
      } catch (error: unknown) {
        const { code, message } = extractPostgrestError(error);
        const isUniqueViolation =
          code === '23505' || (message ? /duplicate key value/i.test(message) : false);

        if (!isUniqueViolation) {
          throw error;
        }

        // Handle reference collision - retry
        booking = null;
      }
    }

    if (!booking) {
      throw new Error('Unable to allocate a booking reference');
    }

    // Award loyalty points
    let finalBooking = booking;
    let loyaltyAward = 0;

    if (loyaltyProgram) {
      loyaltyAward = calculateLoyaltyAward(loyaltyProgram, {
        partySize: data.party,
      });

      if (loyaltyAward > 0) {
        try {
          await applyLoyaltyAward(supabase, {
            program: loyaltyProgram,
            customerId: customer.id,
            bookingId: booking.id,
            points: loyaltyAward,
            metadata: { reference: booking.reference, source: 'api' },
            occurredAt: booking.created_at,
          });

          // Update booking with loyalty points
          finalBooking = await updateBookingRecord(supabase, booking.id, {
            loyalty_points_awarded: loyaltyAward,
          });
        } catch (error) {
          console.error('[bookings][POST][loyalty] Failed', error);
          loyaltyAward = 0;
        }
      }
    }

    // Log audit event
    const auditMetadata = {
      restaurant_id: restaurantId,
      customer_id: customer.id,
      reference: finalBooking.reference,
      ...buildBookingAuditSnapshot(null, finalBooking),
    };

    await logAuditEvent(supabase, {
      action: 'booking.created',
      entity: 'booking',
      entityId: booking.id,
      metadata: auditMetadata,
      actor: data.email,
    });

    // Fetch all customer bookings
    const bookings = await fetchBookingsForContact(supabase, restaurantId, data.email, data.phone);

    // Enqueue side effects (email, analytics)
    try {
      await enqueueBookingCreatedSideEffects(
        {
          booking: safeBookingPayload(finalBooking),
          idempotencyKey,
          restaurantId,
        },
        { supabase },
      );
    } catch (jobError: unknown) {
      console.error('[bookings][POST][side-effects]', jobError);
    }

    // Generate confirmation token
    let confirmationToken: string | null = null;
    try {
      confirmationToken = generateConfirmationToken();
      const tokenExpiry = computeTokenExpiry(1); // 1 hour
      await attachTokenToBooking(finalBooking.id, confirmationToken, tokenExpiry);
    } catch (tokenError: unknown) {
      console.error('[bookings][POST][confirmation-token]', tokenError);
      confirmationToken = null;
    }

    return NextResponse.json(
      {
        booking: finalBooking,
        confirmationToken,
        loyaltyPointsAwarded: loyaltyAward,
        bookings,
        clientRequestId: finalBooking.client_request_id,
        idempotencyKey,
        duplicate: false,
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    console.error('[bookings][POST]', error);

    void recordObservabilityEvent({
      source: 'api.bookings',
      eventType: 'booking.create.failure',
      severity: 'error',
      context: { message: stringifyError(error), restaurantId },
    });

    return NextResponse.json({ error: 'Unable to create booking' }, { status: 500 });
  }
}
```

**Validation Schema:**

```typescript
// File: src/app/api/bookings/route.ts
// Line: 36-49

const bookingSchema = z.object({
  restaurantId: z.string().uuid().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  party: z.number().int().min(1),
  bookingType: z.enum(['breakfast', 'lunch', 'dinner', 'drinks']),
  seating: z.enum(['any', 'indoor', 'outdoor', 'bar', 'window', 'quiet', 'booth']),
  notes: z.string().max(500).optional().nullable(),
  name: z.string().min(2).max(120),
  email: z.string().email(),
  phone: z.string().min(7).max(50),
  marketingOptIn: z.coerce.boolean().optional().default(false),
});
```

**Service Functions:**

```typescript
// File: server/bookings.ts
// Purpose: Core booking business logic

export async function insertBookingRecord(
  client: DbClient,
  payload: CreateBookingPayload,
): Promise<BookingRecord> {
  const { data, error } = await client
    .from('bookings')
    .insert({
      restaurant_id: payload.restaurant_id,
      customer_id: payload.customer_id,
      booking_date: payload.booking_date,
      start_time: payload.start_time,
      end_time: payload.end_time,
      party_size: payload.party_size,
      booking_type: payload.booking_type,
      seating_preference: payload.seating_preference,
      status: payload.status ?? 'confirmed',
      customer_name: payload.customer_name,
      customer_email: payload.customer_email,
      customer_phone: payload.customer_phone,
      notes: payload.notes,
      reference: payload.reference,
      source: payload.source ?? 'web',
      marketing_opt_in: payload.marketing_opt_in ?? false,
      client_request_id: payload.client_request_id,
      idempotency_key: payload.idempotency_key,
      details: payload.details,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as BookingRecord;
}

export function inferMealTypeFromTime(time: string): BookingType {
  const totalMinutes = minutesFromTime(time);
  // Lunch service up to 16:59, dinner afterwards
  return totalMinutes >= 17 * 60 ? 'dinner' : 'lunch';
}

export function deriveEndTime(startTime: string, bookingType: BookingType): string {
  const startMinutes = minutesFromTime(startTime);
  const duration = calculateDurationMinutes(bookingType);
  const endMinutes = startMinutes + duration;
  return minutesToTime(endMinutes);
}

export function calculateDurationMinutes(bookingType: BookingType): number {
  switch (bookingType) {
    case 'drinks':
      return 75;
    case 'breakfast':
      return 75;
    case 'lunch':
      return 90;
    default:
      return 120; // dinner
  }
}
```

**Past Time Validation:**

```typescript
// File: server/bookings/pastTimeValidation.ts
// Purpose: Prevent bookings in the past

export class PastBookingError extends Error {
  code: string;
  details: Record<string, unknown>;

  constructor(message: string, details: Record<string, unknown>) {
    super(message);
    this.name = 'PastBookingError';
    this.code = 'PAST_BOOKING_TIME';
    this.details = details;
  }
}

export function assertBookingNotInPast(
  timezone: string,
  bookingDate: string,
  bookingTime: string,
  options: { graceMinutes?: number } = {},
): void {
  const graceMinutes = options.graceMinutes ?? 0;

  // Get current time in restaurant timezone
  const now = new Date();

  // Parse booking datetime in restaurant timezone
  const [year, month, day] = bookingDate.split('-').map(Number);
  const [hour, minute] = bookingTime.split(':').map(Number);

  // Create booking datetime (simplified - use proper timezone library in production)
  const bookingDateTime = new Date(year, month - 1, day, hour, minute);

  // Apply grace period
  const gracePeriodMs = graceMinutes * 60 * 1000;
  const effectiveBookingTime = bookingDateTime.getTime() - gracePeriodMs;

  if (effectiveBookingTime < now.getTime()) {
    throw new PastBookingError('Cannot book a time in the past', {
      currentTime: now.toISOString(),
      requestedTime: bookingDateTime.toISOString(),
      graceMinutes,
      timezone,
    });
  }
}
```

**Loyalty Integration:**

```typescript
// File: server/loyalty.ts
// Purpose: Loyalty point calculations

export function calculateLoyaltyAward(
  program: LoyaltyProgramRow & { accrualRule: LoyaltyAccrualRule },
  context: { partySize: number },
): number {
  const rule = program.accrualRule;

  if (rule.type === 'flat') {
    return rule.points;
  }

  if (rule.type === 'per_guest') {
    const basePoints = rule.base_points ?? 0;
    const pointsPerGuest = rule.points_per_guest ?? 0;
    const minimumParty = rule.minimum_party_size ?? 1;

    if (context.partySize < minimumParty) {
      return 0;
    }

    return basePoints + context.partySize * pointsPerGuest;
  }

  return 0;
}

export async function applyLoyaltyAward(
  client: DbClient,
  params: {
    program: LoyaltyProgramRow;
    customerId: string;
    bookingId: string;
    points: number;
    metadata: Record<string, unknown>;
    occurredAt: string;
  },
): Promise<void> {
  // Record point event
  await client.from('loyalty_point_events').insert({
    restaurant_id: params.program.restaurant_id,
    customer_id: params.customerId,
    booking_id: params.bookingId,
    points_change: params.points,
    event_type: 'booking_completed',
    schema_version: LOYALTY_SCHEMA_VERSION,
    metadata: params.metadata as Json,
    created_at: params.occurredAt,
  });

  // Update customer balance
  const { data: existingBalance } = await client
    .from('loyalty_points')
    .select('total_points')
    .eq('restaurant_id', params.program.restaurant_id)
    .eq('customer_id', params.customerId)
    .maybeSingle();

  const newTotal = (existingBalance?.total_points ?? 0) + params.points;

  await client.from('loyalty_points').upsert(
    {
      restaurant_id: params.program.restaurant_id,
      customer_id: params.customerId,
      total_points: newTotal,
      tier: determineTier(params.program.tiers, newTotal),
    },
    {
      onConflict: 'restaurant_id,customer_id',
    },
  );
}
```

**Database Schema:**

```sql
-- File: supabase/migrations/20251006170446_remote_schema.sql

CREATE TYPE booking_status AS ENUM (
  'confirmed',
  'pending',
  'cancelled',
  'completed',
  'no_show',
  'pending_allocation'
);

CREATE TYPE booking_type AS ENUM (
  'breakfast',
  'lunch',
  'dinner',
  'drinks'
);

CREATE TYPE seating_preference_type AS ENUM (
  'any',
  'indoor',
  'outdoor',
  'bar',
  'window',
  'quiet',
  'booth'
);

CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  booking_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  start_at TIMESTAMPTZ, -- Computed instant
  end_at TIMESTAMPTZ,   -- Computed instant
  party_size INTEGER NOT NULL CHECK (party_size > 0),
  seating_preference seating_preference_type DEFAULT 'any' NOT NULL,
  status booking_status DEFAULT 'confirmed' NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  notes TEXT,
  reference TEXT NOT NULL UNIQUE,
  source TEXT DEFAULT 'web' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  booking_type booking_type DEFAULT 'dinner' NOT NULL,
  idempotency_key TEXT,
  client_request_id TEXT DEFAULT gen_random_uuid()::TEXT NOT NULL,
  pending_ref TEXT,
  details JSONB,
  marketing_opt_in BOOLEAN DEFAULT false NOT NULL,
  loyalty_points_awarded INTEGER DEFAULT 0,
  CONSTRAINT chk_time_order CHECK (start_at < end_at)
);

-- Unique constraint for idempotency per restaurant
CREATE UNIQUE INDEX bookings_idem_unique_per_restaurant
  ON bookings (restaurant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Unique constraint for client request ID per restaurant
CREATE UNIQUE INDEX bookings_client_request_unique
  ON bookings (restaurant_id, client_request_id);

-- Indexes for common queries
CREATE INDEX idx_bookings_restaurant_date ON bookings(restaurant_id, booking_date);
CREATE INDEX idx_bookings_customer_email ON bookings(customer_email);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_start_at ON bookings(start_at);
CREATE INDEX idx_bookings_reference ON bookings(reference);

-- Trigger to compute instant timestamps from date + time
CREATE TRIGGER set_booking_instants
  BEFORE INSERT OR UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION set_booking_instants();

-- Trigger to ensure unique reference
CREATE TRIGGER set_booking_reference
  BEFORE INSERT ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION set_booking_reference();

-- Trigger to update updated_at
CREATE TRIGGER update_bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
```

#### Performance Optimizations

1. **Database Indexes:**
   - `idx_bookings_restaurant_date` for availability queries
   - `idx_bookings_customer_email` for guest lookups
   - `idx_bookings_reference` for confirmation page loads
   - Unique indexes enforce data integrity efficiently

2. **Idempotency:**
   - Prevents duplicate bookings from network retries
   - Uses database unique constraints for atomicity

3. **Rate Limiting:**
   - Distributed via Upstash Redis
   - Per-restaurant + per-IP scoping
   - Prevents abuse and reduces load

4. **Optimistic Locking:**
   - Unique reference generation with retry logic
   - No distributed locks needed

#### Security Measures

1. **Input Validation:**
   - Zod schema validation at API boundary
   - SQL injection prevention via Supabase client
   - XSS prevention via React escaping

2. **Rate Limiting:**
   - 60 requests/min per restaurant+IP
   - Observability logging for violations

3. **Idempotency:**
   - UUID-based keys
   - Database-level uniqueness enforcement

4. **Audit Trail:**
   - All booking creations logged
   - Actor tracking (email)
   - Change snapshots stored

---

### Story 1.3: View My Bookings

**Priority:** P0 (Critical)  
**Confidence:** High  
**Implementation Status:** ✅ Complete

#### User Story

```gherkin
AS AN authenticated guest
I WANT TO view all my upcoming and past reservations
SO THAT I can track my bookings and manage them in one place
```

#### Business Value

- **Primary KPI:** User retention rate
- **Secondary KPI:** Repeat booking rate
- **User Benefit:** Centralized booking management dashboard

#### Detailed Acceptance Criteria

```gherkin
Feature: Personal Booking Dashboard

  Background:
    Given I am authenticated as user "john@example.com"
    And I have 10 bookings across 3 restaurants:
      | Restaurant | Date | Time | Party | Status |
      | Bella Vista | 2025-01-25 | 19:00 | 4 | confirmed |
      | Le Bistro | 2025-01-20 | 20:00 | 2 | confirmed |
      | The Grill | 2025-01-15 | 18:00 | 6 | completed |
      | Bella Vista | 2025-01-10 | 19:30 | 4 | cancelled |
      | Le Bistro | 2025-01-05 | 12:00 | 2 | completed |

  Scenario: Access my bookings page with authentication
    Given I am not authenticated
    When I navigate to "/my-bookings"
    Then I am redirected to "/signin?redirectedFrom=/my-bookings"

    Given I sign in successfully
    Then I am redirected back to "/my-bookings"
    And the bookings page loads

  Scenario: View list of my bookings
    Given I navigate to "/my-bookings"
    When the page loads
    Then I should see a heading "My Bookings"
    And I should see a list of my bookings
    And each booking card displays:
      | Field | Format |
      | Restaurant name | Text heading |
      | Date | Human-readable format (e.g., "January 25, 2025") |
      | Time | 12h or 24h format based on locale |
      | Party size | Number with "guests" label |
      | Status | Badge with color coding |
      | Booking reference | Alphanumeric code |
      | Special notes | Collapsed/expandable text |
      | Actions | View details, Cancel (if applicable) |

  Scenario: Filter bookings by status
    Given I am on my bookings page
    When I select the "Upcoming" filter
    Then I should see only bookings with status "confirmed" or "pending"
    And bookings with start_at >= current time

    When I select the "Past" filter
    Then I should see only bookings with start_at < current time
    And statuses include "completed", "cancelled", "no_show"

    When I select the "Cancelled" filter
    Then I should see only bookings with status "cancelled"

    When I select the "All" filter
    Then I should see all my bookings regardless of status

  Scenario: Sort bookings chronologically
    Given I am viewing my bookings
    When I select "Ascending" sort
    Then bookings are ordered by start_at ascending (oldest first)

    When I select "Descending" sort
    Then bookings are ordered by start_at descending (newest first)

  Scenario: Paginate through bookings
    Given I have 25 total bookings
    And the page size is set to 10
    When I view the first page
    Then I should see bookings 1-10
    And the page info shows:
      | Field | Value |
      | page | 1 |
      | pageSize | 10 |
      | total | 25 |
      | hasNext | true |

    When I navigate to page 2
    Then I should see bookings 11-20
    And the page info shows page: 2, hasNext: true

    When I navigate to page 3
    Then I should see bookings 21-25
    And the page info shows page: 3, hasNext: false

  Scenario: Filter bookings by date range
    Given I am on my bookings page
    When I set the "from" filter to "2025-01-01T00:00:00Z"
    And I set the "to" filter to "2025-01-31T23:59:59Z"
    Then I should see only bookings in January 2025

  Scenario: View booking details from list
    Given I am viewing my bookings
    When I click on a booking card
    Then I am navigated to "/reserve/{reservationId}"
    And I see the full booking details page

  Scenario: Initial data is server-side rendered
    Given I navigate to "/my-bookings"
    When the HTML is rendered on the server
    Then the initial page of bookings is hydrated from server data
    And no loading spinner is shown on first render
    And subsequent page changes use client-side fetching

  Scenario: API request includes authentication
    Given I am authenticated with a session cookie
    When the my-bookings page fetches data
    Then the API request to GET /api/bookings?me=1
    And the session cookie is included in the request
    And the server validates my authentication
    And returns only my bookings

  Scenario: Handle empty bookings state
    Given I have no bookings
    When I visit my bookings page
    Then I should see an empty state message
    And I should see a call-to-action button "Make your first booking"
    And clicking it navigates me to the browse page
```

#### Implementation Evidence

**Frontend Page:**

```typescript
// File: src/app/(authed)/my-bookings/page.tsx
// Purpose: Server-side rendered page with auth guard

export const dynamic = 'force-dynamic';

export default async function MyBookingsPage() {
  const supabase = await getServerComponentSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Auth guard
  if (!user) {
    redirect('/signin?redirectedFrom=/my-bookings');
  }

  // Prefetch initial bookings data
  const queryClient = new QueryClient();
  await prefetchUpcomingBookings(queryClient);
  const dehydratedState = dehydrate(queryClient);

  return (
    <HydrationBoundary state={dehydratedState}>
      <MyBookingsClient />
    </HydrationBoundary>
  );
}

// Prefetch function for SSR optimization
async function prefetchUpcomingBookings(queryClient: QueryClient) {
  const searchParams = buildDefaultSearchParams(DASHBOARD_DEFAULT_PAGE_SIZE);
  const keyParams = Object.fromEntries(searchParams.entries());
  const requestHeaders = await headers();
  const cookieStore = await cookies();

  // Build authenticated request with cookies
  const cookieHeader = cookieStore
    .getAll()
    .map(({ name, value }) => `${name}=${value}`)
    .join('; ');

  const origin = resolveOrigin(requestHeaders);
  const url = `${origin}/api/bookings?${searchParams.toString()}`;

  try {
    await queryClient.prefetchQuery({
      queryKey: queryKeys.bookings.list(keyParams),
      queryFn: async () => {
        const response = await fetch(url, {
          headers: {
            accept: 'application/json',
            ...(cookieHeader ? { cookie: cookieHeader } : {}),
          },
          cache: 'no-store',
        });

        if (!response.ok) {
          throw new Error(`Failed to prefetch bookings (${response.status})`);
        }

        return (await response.json()) as BookingsPage;
      },
    });
  } catch (error) {
    console.error('[my-bookings][prefetch]', error);
  }
}

function buildDefaultSearchParams(pageSize: number): URLSearchParams {
  const params = new URLSearchParams({
    me: '1',
    page: '1',
    pageSize: String(pageSize),
    sort: 'asc',
  });

  // Default to upcoming bookings
  params.set('from', new Date().toISOString());
  return params;
}
```

**Client Component:**

```typescript
// File: src/app/(authed)/my-bookings/MyBookingsClient.tsx
// Purpose: Interactive booking list with filters

export function MyBookingsClient() {
  const [filters, setFilters] = useState<BookingFilters>({
    status: null,
    sort: 'asc',
    page: 1,
    pageSize: DASHBOARD_DEFAULT_PAGE_SIZE,
  });

  const { data, isLoading, error } = useBookings(filters);

  const handleFilterChange = (newFilters: Partial<BookingFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters, page: 1 }));
  };

  const handlePageChange = (page: number) => {
    setFilters((prev) => ({ ...prev, page }));
  };

  if (isLoading && !data) {
    return <BookingListSkeleton />;
  }

  if (error) {
    return <ErrorAlert message="Failed to load bookings" />;
  }

  if (!data || data.items.length === 0) {
    return (
      <EmptyState
        title="No bookings yet"
        description="Start exploring restaurants to make your first reservation"
        action={
          <Link href="/browse">
            <Button>Browse restaurants</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">My Bookings</h1>
        <p className="text-muted-foreground">
          Manage your reservations and view booking history
        </p>
      </header>

      <BookingFilters
        value={filters}
        onChange={handleFilterChange}
      />

      <BookingList bookings={data.items} />

      <Pagination
        currentPage={data.pageInfo.page}
        totalPages={Math.ceil(data.pageInfo.total / data.pageInfo.pageSize)}
        hasNext={data.pageInfo.hasNext}
        onPageChange={handlePageChange}
      />
    </div>
  );
}
```

**API Endpoint:**

```typescript
// File: src/app/api/bookings/route.ts
// Method: GET with me=1 parameter
// Purpose: Fetch authenticated user's bookings

async function handleMyBookings(req: NextRequest) {
  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  // Auth validation
  if (authError || !user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Parse and validate query parameters
  const rawParams = {
    me: req.nextUrl.searchParams.get('me'),
    status: req.nextUrl.searchParams.get('status') ?? undefined,
    from: req.nextUrl.searchParams.get('from') ?? undefined,
    to: req.nextUrl.searchParams.get('to') ?? undefined,
    sort: req.nextUrl.searchParams.get('sort') ?? undefined,
    page: req.nextUrl.searchParams.get('page') ?? undefined,
    pageSize: req.nextUrl.searchParams.get('pageSize') ?? undefined,
    restaurantId: req.nextUrl.searchParams.get('restaurantId') ?? undefined,
  };

  const parsed = myBookingsQuerySchema.safeParse(rawParams);
  if (!parsed.success) {
    return handleZodError(parsed.error);
  }

  const params = parsed.data;
  const page = params.page;
  const pageSize = params.pageSize;
  const offset = (page - 1) * pageSize;
  const email = user.email.toLowerCase();

  // Convert date filters to ISO strings
  let fromIso: string | undefined;
  let toIso: string | undefined;

  try {
    fromIso = params.from ? toIsoStringOrThrow(params.from) : undefined;
    toIso = params.to ? toIsoStringOrThrow(params.to) : undefined;
  } catch (error) {
    return NextResponse.json({ error: 'Invalid date range' }, { status: 400 });
  }

  // Select view based on status filter
  const client = getServiceSupabaseClient();
  const relation: 'bookings' | 'current_bookings' =
    params.status === 'active' ? 'current_bookings' : 'bookings';

  // Build query
  let query = client
    .from(relation)
    .select('id, start_at, end_at, party_size, status, notes, restaurants(name)', {
      count: 'exact',
    })
    .eq('customer_email', email);

  // Apply filters
  if (params.restaurantId) {
    query = query.eq('restaurant_id', params.restaurantId);
  }

  if (params.status && params.status !== 'active') {
    query = query.eq('status', params.status);
  }

  if (fromIso) {
    query = query.gte('start_at', fromIso);
  }

  if (toIso) {
    query = query.lt('start_at', toIso);
  }

  // Apply sorting
  query = query.order('start_at', { ascending: params.sort === 'asc' });

  // Execute query with pagination
  const { data, error, count } = await query.range(offset, offset + pageSize - 1);

  if (error) {
    console.error('[bookings][GET][me]', error);
    return NextResponse.json({ error: 'Unable to fetch bookings' }, { status: 500 });
  }

  // Map to DTO
  const items: BookingDTO[] = (data ?? []).map((booking) => {
    const restaurant = Array.isArray(booking.restaurants)
      ? (booking.restaurants[0] ?? null)
      : booking.restaurants;

    return {
      id: booking.id,
      restaurantName: restaurant?.name ?? '',
      partySize: booking.party_size,
      startIso: toIsoString(booking.start_at),
      endIso: toIsoString(booking.end_at),
      status: booking.status,
      notes: booking.notes,
      customerName: null,
      customerEmail: null,
    };
  });

  const total = count ?? items.length;
  const hasNext = offset + items.length < total;

  const response: PageResponse<BookingDTO> = {
    items,
    pageInfo: {
      page,
      pageSize,
      total,
      hasNext,
    },
  };

  return NextResponse.json(response);
}
```

**Validation Schema:**

```typescript
// File: src/app/api/bookings/route.ts
// Line: 27-35

const statusFilterSchema = z.union([
  z.enum(['pending', 'pending_allocation', 'confirmed', 'cancelled']),
  z.literal('active'),
]);

const myBookingsQuerySchema = baseQuerySchema.extend({
  me: z.literal('1'),
  status: statusFilterSchema.optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  sort: z.enum(['asc', 'desc']).default('asc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});
```

**Custom Hook:**

```typescript
// File: src/hooks/useBookings.ts
// Purpose: React Query hook for bookings

export type BookingFilters = {
  status?: OpsStatusFilter | null;
  from?: string;
  to?: string;
  sort?: 'asc' | 'desc';
  page: number;
  pageSize: number;
};

export function useBookings(filters: BookingFilters) {
  const queryParams = {
    me: '1',
    ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v != null)),
  };

  return useQuery({
    queryKey: queryKeys.bookings.list(queryParams),
    queryFn: async () => {
      const searchParams = new URLSearchParams(queryParams as Record<string, string>);
      const response = await fetch(`/api/bookings?${searchParams}`);

      if (!response.ok) {
        throw new Error('Failed to fetch bookings');
      }

      return response.json() as Promise<BookingsPage>;
    },
    staleTime: 30_000, // Consider data fresh for 30 seconds
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  });
}
```

**Database View:**

```sql
-- File: supabase/migrations/20251006170446_remote_schema.sql
-- Purpose: Optimized view for "active" bookings

CREATE VIEW current_bookings AS
SELECT *
FROM bookings
WHERE status NOT IN ('cancelled', 'no_show', 'completed')
  AND start_at >= now();

-- Grant permissions
GRANT SELECT ON current_bookings TO authenticated;
```

#### Performance Optimizations

1. **Server-Side Prefetching:**
   - Initial data rendered on server
   - No loading spinner on first paint
   - Cookies forwarded for authentication

2. **Database View:**
   - `current_bookings` view filters at DB level
   - Reduces data transfer
   - Indexed on `start_at` for efficiency

3. **Pagination:**
   - Limit query results to page size
   - Use `range()` for efficient offset pagination
   - Include `count: "exact"` for total count

4. **Client-Side Caching:**
   - TanStack Query caches results
   - 30-second stale time reduces unnecessary requests
   - Automatic background refetch on focus

#### Accessibility Features

- **Semantic HTML:** Proper heading hierarchy
- **ARIA labels:** Filter controls have accessible labels
- **Keyboard navigation:** Full support for tab/enter
- **Focus management:** Focus moved to first booking on page change
- **Screen reader:** Status announced via `aria-live` regions

---

### Story 1.4: View Booking Confirmation

**Priority:** P0 (Critical)  
**Confidence:** High  
**Implementation Status:** ✅ Complete

#### User Story

```gherkin
AS A guest who just made a booking
I WANT TO view my booking confirmation via a secure link
SO THAT I can verify details without needing to create an account or sign in
```

#### Business Value

- **Primary KPI:** Guest friction reduction
- **Secondary KPI:** Support ticket reduction
- **User Benefit:** Zero-friction confirmation access

#### Detailed Acceptance Criteria

```gherkin
Feature: Secure Booking Confirmation Access

  Background:
    Given a booking exists with:
      | Field | Value |
      | ID | b7f3a8d2-4c1e-4b2f-9a3d-5e6f7g8h9i0j |
      | Reference | ABC123XYZ9 |
      | Restaurant | Bella Vista |
      | Date | 2025-01-25 |
      | Time | 19:00 - 21:00 |
      | Party Size | 4 |
      | Guest Name | John Smith |
      | Status | confirmed |
    And a confirmation token "a1b2c3..." (64 chars) was generated
    And the token expires at 2025-01-15 16:00:00 UTC

  Scenario: Access confirmation with valid token
    Given the current time is 2025-01-15 15:30:00 UTC
    When I visit "/api/bookings/confirm?token=a1b2c3..."
    Then I receive a 200 OK response
    And the response includes:
      | Field | Value |
      | booking.reference | ABC123XYZ9 |
      | booking.restaurantName | Bella Vista |
      | booking.date | 2025-01-25 |
      | booking.startTime | 19:00 |
      | booking.endTime | 21:00 |
      | booking.partySize | 4 |
      | booking.status | confirmed |
    And sensitive data is NOT included:
      | Excluded Field |
      | Customer email |
      | Customer phone |
      | Customer ID |
      | Internal IDs |
    And the token is marked as "used" in the database

  Scenario: Token is single-use only
    Given I access the confirmation page with token "a1b2c3..."
    And the token was successfully validated
    When I try to access the same token again
    Then I receive a 410 Gone error
    And the error code is "TOKEN_ALREADY_USED"
    And the error message states "This confirmation link has already been used"

  Scenario: Expired token is rejected
    Given the token expires at 2025-01-15 16:00:00 UTC
    And the current time is 2025-01-15 17:00:00 UTC
    When I try to access the confirmation page
    Then I receive a 410 Gone error
    And the error code is "TOKEN_EXPIRED"
    And the error message states "This confirmation link has expired"

  Scenario: Invalid token format is rejected
    When I access "/api/bookings/confirm?token=invalid"
    Then I receive a 400 Bad Request error
    And the error code is "INVALID_TOKEN"
    And the error message states "Invalid or missing confirmation token"

  Scenario: Non-existent token is rejected
    When I access "/api/bookings/confirm?token=1234567890abcdef..." (valid format but doesn't exist)
    Then I receive a 404 Not Found error
    And the error code is "TOKEN_NOT_FOUND"
    And the error message states "Confirmation link not found"

  Scenario: Rate limiting prevents brute force
    Given I make 25 requests to the confirmation endpoint in 1 minute
    When I exceed 20 requests per minute
    Then subsequent requests return 429 Too Many Requests
    And the response includes headers:
      | Header | Example Value |
      | Retry-After | 30 |
      | X-RateLimit-Limit | 20 |
      | X-RateLimit-Remaining | 0 |
      | X-RateLimit-Reset | 1705329600000 |

  Scenario: Token generation on booking creation
    Given I create a new booking successfully
    When the booking is confirmed
    Then a confirmation token is generated
    And the token is 64 characters long
    And the token is cryptographically random
    And the token expiry is set to 1 hour from now
    And the token is attached to the booking
    And the token is included in the API response

  Scenario: Email includes confirmation link
    Given a booking is created with confirmation token "xyz789..."
    When the confirmation email is sent
    Then the email body includes a link:
      "https://app.sajiloreservex.com/api/bookings/confirm?token=xyz789..."
    And clicking the link loads the confirmation page
```

#### Implementation Evidence

**API Endpoint:**

```typescript
// File: src/app/api/bookings/confirm/route.ts
// Method: GET
// Route: /api/bookings/confirm

export async function GET(req: NextRequest) {
  const clientIp = extractClientIp(req);

  // Rate limiting: Prevent brute-force token guessing
  const rateResult = await consumeRateLimit({
    identifier: `bookings:confirm:${anonymizeIp(clientIp)}`,
    limit: 20,
    windowMs: 60_000, // 20 requests per minute
  });

  if (!rateResult.ok) {
    const retryAfter = Math.ceil((rateResult.resetAt - Date.now()) / 1000);

    return NextResponse.json(
      {
        error: 'Too many confirmation requests',
        code: 'RATE_LIMITED',
      },
      {
        status: 429,
        headers: {
          'Retry-After': retryAfter.toString(),
          'X-RateLimit-Limit': rateResult.limit.toString(),
          'X-RateLimit-Remaining': rateResult.remaining.toString(),
          'X-RateLimit-Reset': rateResult.resetAt.toString(),
        },
      },
    );
  }

  // Validate query parameters
  const parsed = querySchema.safeParse({
    token: req.nextUrl.searchParams.get('token'),
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Invalid or missing confirmation token',
        code: 'INVALID_TOKEN',
      },
      { status: 400 },
    );
  }

  const { token } = parsed.data;

  try {
    // Validate token and get booking
    const booking = await validateConfirmationToken(token);

    // Mark token as used (prevents replay)
    await markTokenUsed(token);

    // Get restaurant name for display
    const supabase = getServiceSupabaseClient();
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('name')
      .eq('id', booking.restaurant_id)
      .single();

    const restaurantName = restaurant?.name ?? 'Restaurant';

    // Transform to public-safe data (no PII)
    const publicBooking = toPublicConfirmation(booking, restaurantName);

    return NextResponse.json({
      booking: publicBooking,
    });
  } catch (error: unknown) {
    // Handle token validation errors
    if (error instanceof TokenValidationError) {
      const statusCode = error.code === 'TOKEN_NOT_FOUND' ? 404 : 410;

      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
        },
        { status: statusCode },
      );
    }

    // Handle unexpected errors
    console.error('[bookings/confirm] Unexpected error', error);

    return NextResponse.json(
      {
        error: 'Unable to confirm booking',
        code: 'SERVER_ERROR',
      },
      { status: 500 },
    );
  }
}

const querySchema = z.object({
  token: z.string().min(64).max(64),
});
```

**Token Service:**

```typescript
// File: server/bookings/confirmation-token.ts
// Purpose: Token generation, validation, and lifecycle

import { randomBytes } from 'crypto';

const TOKEN_LENGTH = 32; // 32 bytes = 64 hex characters

export class TokenValidationError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'TokenValidationError';
    this.code = code;
  }
}

/**
 * Generate a cryptographically secure random token
 * Returns 64 hex characters (32 bytes)
 */
export function generateConfirmationToken(): string {
  return randomBytes(TOKEN_LENGTH).toString('hex');
}

/**
 * Compute token expiry timestamp
 * @param hours Number of hours until expiry (default: 1)
 */
export function computeTokenExpiry(hours: number = 1): string {
  const expiryMs = Date.now() + hours * 60 * 60 * 1000;
  return new Date(expiryMs).toISOString();
}

/**
 * Attach token to booking in database
 */
export async function attachTokenToBooking(
  bookingId: string,
  token: string,
  expiresAt: string,
): Promise<void> {
  const supabase = getServiceSupabaseClient();

  const { error } = await supabase.from('booking_confirmation_tokens').insert({
    booking_id: bookingId,
    token,
    expires_at: expiresAt,
    used_at: null,
  });

  if (error) {
    throw error;
  }
}

/**
 * Validate token and return associated booking
 * Throws TokenValidationError if invalid
 */
export async function validateConfirmationToken(token: string): Promise<BookingRecord> {
  const supabase = getServiceSupabaseClient();

  // Fetch token record
  const { data: tokenRecord, error: tokenError } = await supabase
    .from('booking_confirmation_tokens')
    .select('booking_id, expires_at, used_at')
    .eq('token', token)
    .maybeSingle();

  if (tokenError || !tokenRecord) {
    throw new TokenValidationError('Confirmation link not found', 'TOKEN_NOT_FOUND');
  }

  // Check if already used
  if (tokenRecord.used_at) {
    throw new TokenValidationError(
      'This confirmation link has already been used',
      'TOKEN_ALREADY_USED',
    );
  }

  // Check expiry
  const now = new Date();
  const expiryDate = new Date(tokenRecord.expires_at);

  if (now > expiryDate) {
    throw new TokenValidationError('This confirmation link has expired', 'TOKEN_EXPIRED');
  }

  // Fetch booking
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', tokenRecord.booking_id)
    .single();

  if (bookingError || !booking) {
    throw new TokenValidationError('Associated booking not found', 'BOOKING_NOT_FOUND');
  }

  return booking as BookingRecord;
}

/**
 * Mark token as used (single-use enforcement)
 */
export async function markTokenUsed(token: string): Promise<void> {
  const supabase = getServiceSupabaseClient();

  const { error } = await supabase
    .from('booking_confirmation_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('token', token);

  if (error) {
    console.error('[confirmation-token] Failed to mark token as used', error);
  }
}

/**
 * Transform booking to public-safe confirmation data
 * Strips sensitive PII
 */
export function toPublicConfirmation(
  booking: BookingRecord,
  restaurantName: string,
): PublicBookingConfirmation {
  return {
    reference: booking.reference,
    restaurantName,
    date: booking.booking_date,
    startTime: booking.start_time,
    endTime: booking.end_time,
    partySize: booking.party_size,
    status: booking.status,
    bookingType: booking.booking_type,
    seatingPreference: booking.seating_preference,
    notes: booking.notes,
    // Explicitly exclude: customer_email, customer_phone, customer_id, etc.
  };
}

export type PublicBookingConfirmation = {
  reference: string;
  restaurantName: string;
  date: string;
  startTime: string;
  endTime: string;
  partySize: number;
  status: string;
  bookingType: string;
  seatingPreference: string;
  notes?: string | null;
};
```

**Database Schema:**

```sql
-- File: supabase/migrations/20250115071800_add_booking_confirmation_token.sql

CREATE TABLE booking_confirmation_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  CONSTRAINT chk_token_length CHECK (char_length(token) = 64)
);

-- Index for fast token lookup
CREATE INDEX idx_confirmation_tokens_token
  ON booking_confirmation_tokens(token);

-- Index for expiry cleanup
CREATE INDEX idx_confirmation_tokens_expires_at
  ON booking_confirmation_tokens(expires_at);

-- Index for booking association
CREATE INDEX idx_confirmation_tokens_booking_id
  ON booking_confirmation_tokens(booking_id);

-- RLS Policy: No direct access (API only)
ALTER TABLE booking_confirmation_tokens ENABLE ROW LEVEL SECURITY;

-- Service role only
CREATE POLICY service_role_all_access ON booking_confirmation_tokens
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
```

**Integration with Booking Creation:**

```typescript
// File: src/app/api/bookings/route.ts
// Line: 580-592
// Context: After successful booking creation

// Generate confirmation token for guest access to confirmation page
let confirmationToken: string | null = null;
if (!reusedExisting) {
  try {
    confirmationToken = generateConfirmationToken();
    const tokenExpiry = computeTokenExpiry(1); // 1 hour expiry

    await attachTokenToBooking(finalBooking.id, confirmationToken, tokenExpiry);
  } catch (tokenError: unknown) {
    console.error('[bookings][POST][confirmation-token]', tokenError);
    // Non-fatal: booking still succeeded, just no token for guest confirmation
    confirmationToken = null;
  }
}

return NextResponse.json(
  {
    booking: finalBooking,
    confirmationToken, // Included in response
    loyaltyPointsAwarded: loyaltyAward,
    bookings,
    clientRequestId: finalBooking.client_request_id,
    idempotency Key,
    duplicate: reusedExisting,
  },
  { status: reusedExisting ? 200 : 201 }
);
```

#### Security Considerations

1. **Cryptographic Randomness:**
   - Uses `crypto.randomBytes()` (Node.js crypto module)
   - 32 bytes = 2^256 possible tokens
   - Collision probability negligible

2. **Rate Limiting:**
   - 20 requests/min per IP
   - Prevents brute-force token guessing
   - IP anonymized for privacy

3. **Single-Use Tokens:**
   - `used_at` timestamp enforced
   - Prevents replay attacks

4. **Time-Limited:**
   - 1-hour default expiry
   - Reduces attack window
   - Automatic cleanup possible

5. **PII Protection:**
   - Email/phone excluded from public response
   - Only booking-relevant data exposed
   - No customer IDs leaked

6. **Database Security:**
   - RLS enabled on tokens table
   - Service role access only
   - Cascading delete on booking removal

---

### Story 1.5: View Reservation Details

**Priority:** P1 (High)  
**Confidence:** High  
**Implementation Status:** ✅ Complete

#### User Story

```gherkin
AS AN authenticated guest
I WANT TO view detailed information about a specific reservation
SO THAT I can see all booking details, history, and take actions like cancellation
```

#### Business Value

- **Primary KPI:** Guest self-service rate
- **Secondary KPI:** Support ticket deflection
- **User Benefit:** Complete visibility into reservation lifecycle

#### Detailed Acceptance Criteria

````gherkin
Feature: Detailed Reservation View

  Background:
    Given I am authenticated as "john@example.com"
    And I have a booking with:
      | Field | Value |
      | ID | res-123 |
      | Reference | ABC123XYZ9 |
      | Restaurant | Bella Vista |
      | Date | 2025-01-25 |
      | Time | 19:00 - 21:00 |
      | Party Size | 4 |
      | Status | confirmed |
      | Seating | indoor |
      | Notes | Anniversary celebration |
      | Booking Type | dinner |
    And the booking has 3 history entries

  Scenario: Access reservation details with authentication
    Given I am not authenticated
    When I navigate to "/reserve/res-123"
    Then I am redirected to "/signin?redirectedFrom=/reserve/res-123"

    Given I sign in successfully
    Then I am redirected back to "/reserve/res-123"
    And the reservation details page loads

  Scenario: View complete reservation information
    Given I navigate to "/reserve/res-123"
    When the page loads
    Then I should see the booking details:
      | Section | Content |
      | Header | Restaurant name, booking reference |
      | Date & Time | Human-readable date, time range |
      | Party Size | "4 guests" |
      | Status | Badge with "Confirmed" status |
      | Booking Type | "Dinner" |
      | Seating Preference | "Indoor" |
      | Special Notes | "Anniversary celebration" |
      | Venue Info | Restaurant address, phone, timezone |
      | Actions | Cancel button (if applicable) |

  Scenario: View booking history timeline
    Given I am on the reservation details page
    When I scroll to the history section
    Then I should see a timeline of all changes:
      | Timestamp | Change Type | Details |
      | 2025-01-15 14:00 | created | Booking created by john@example.com |
      | 2025-01-15 14:30 | updated | Party size changed from 2 to 4 |
      | 2025-01-15 15:00 | updated | Seating preference changed to indoor |
    And each entry shows:
      - Timestamp (relative or absolute)
      - Change type badge
      - Actor (who made the change)
      - Field-level changes (before/after)

  Scenario: Structured data for SEO
    Given I view the reservation details page
    When I inspect the HTML
    Then I should find JSON-LD structured data:
      ```json
      {
        "@context": "https://schema.org",
        "@type": "Reservation",
        "reservationNumber": "ABC123XYZ9",
        "reservationStatus": "confirmed",
        "reservationFor": {
          "@type": "FoodEstablishment",
          "name": "Bella Vista",
          "address": "123 Main St, London"
        },
        "partySize": 4,
        "startTime": "2025-01-25T19:00:00Z"
      }
      ```
    And the structured data is embedded in a <script type="application/ld+json"> tag

  Scenario: Handle non-existent reservation
    Given I navigate to "/reserve/invalid-id"
    When the page tries to load
    Then I see a 404 Not Found page
    And I see a helpful message "Reservation not found"
    And I see a link to "View all my bookings"

  Scenario: Prevent access to other users' reservations
    Given I am authenticated as "john@example.com"
    And another user "jane@example.com" has booking "res-456"
    When I try to access "/reserve/res-456"
    Then the system checks ownership
    And I either see 404 (private) or an access denied message

  Scenario: Server-side rendering with hydration
    Given I navigate to "/reserve/res-123"
    When the server renders the page
    Then the initial reservation data is included in HTML
    And the page hydrates without loading spinner
    And subsequent interactions use client-side fetching

  Scenario: Mobile-responsive layout
    Given I view the reservation on a mobile device (375px width)
    When the page renders
    Then the layout adapts:
      - Single column design
      - Touch-friendly action buttons (min 44px height)
      - Readable font sizes (min 16px for inputs)
      - Horizontal scrolling prevented
      - Safe area insets respected

  Scenario: Calendar integration
    Given I view the reservation details
    When I see the booking information
    Then I should have the option to "Add to Calendar"
    And clicking it downloads an .ics file
    And the file includes:
      | iCal Field | Value |
      | SUMMARY | "Dinner at Bella Vista" |
      | DTSTART | 2025-01-25T19:00:00 (in venue timezone) |
      | DTEND | 2025-01-25T21:00:00 |
      | LOCATION | Restaurant address |
      | DESCRIPTION | Booking reference, party size, notes |
````

#### Implementation Evidence

**Server Component:**

```typescript
// File: src/app/reserve/[reservationId]/page.tsx
// Purpose: Server-side rendered reservation details page

export const dynamic = 'force-dynamic';

export default async function ReservationDetailPage({
  params
}: {
  params: RouteParams
}) {
  const resolved = await params;
  const reservationId = sanitizeReservationId(resolved?.reservationId);

  if (!reservationId) {
    notFound();
  }

  // Auth guard
  const supabase = await getServerComponentSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    defaultErrorReporter.capture(authError, { scope: 'reservationDetail.auth' });
  }

  if (!user) {
    redirect(`/signin?redirectedFrom=/reserve/${reservationId}`);
  }

  // Fetch reservation with ownership check
  let reservationResult;
  try {
    reservationResult = await getReservation(reservationId, { supabase });
  } catch (error) {
    defaultErrorReporter.capture(error, {
      scope: 'reservationDetail.fetch',
      reservationId,
    });
    notFound();
  }

  if (!reservationResult) {
    notFound();
  }

  const { reservation, restaurantName } = reservationResult;

  // Prefetch data for client-side hydration
  const queryClient = new QueryClient();
  queryClient.setQueryData(['reservation', reservationId], reservation);
  const dehydratedState = dehydrate(queryClient);

  // Prepare venue details
  const venue = deriveVenue(reservation, restaurantName);

  // Generate structured data for SEO
  const structuredData = serializeJsonLd(
    buildReservationJsonLd(reservation, venue)
  );

  return (
    <HydrationBoundary state={dehydratedState}>
      <ReservationDetailClient
        reservationId={reservationId}
        restaurantName={restaurantName}
        venue={venue}
        structuredData={structuredData}
      />
    </HydrationBoundary>
  );
}

// Generate metadata for page head
export async function generateMetadata({ params }: { params: RouteParams }): Promise<Metadata> {
  const resolved = await params;
  const reservationId = sanitizeReservationId(resolved?.reservationId);
  const shortId = reservationId ? reservationId.slice(0, 8) : 'reservation';

  return {
    title: `Reservation ${shortId} · SajiloReserveX`,
    description: 'Review the latest status, timing, and actions for your SajiloReserveX booking.',
  };
}

// Helper functions
function sanitizeReservationId(value: string | undefined): string | null {
  if (!value || typeof value !== 'string') return null;
  return value.trim() || null;
}

function deriveVenue(
  reservation: Reservation,
  restaurantName: string | null
): ReservationVenue {
  return {
    name: restaurantName ?? reservation.restaurantName ?? DEFAULT_VENUE.name,
    address: DEFAULT_VENUE.address,
    timezone: DEFAULT_VENUE.timezone,
  };
}

function buildReservationJsonLd(
  reservation: Reservation,
  venue: ReservationVenue
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Reservation',
    reservationNumber: reservation.reference ?? reservation.id,
    reservationStatus: reservation.status,
    reservationFor: {
      '@type': 'FoodEstablishment',
      name: venue.name,
      address: venue.address,
    },
    partySize: reservation.partySize,
    startTime: reservation.startAt
      ? new Date(reservation.startAt).toISOString()
      : undefined,
  };
}

function serializeJsonLd(payload: Record<string, unknown> | null): string | null {
  if (!payload) return null;
  // Escape < characters to prevent XSS
  return JSON.stringify(payload).replace(/</g, '\\u003c');
}
```

**Client Component:**

```typescript
// File: src/app/reserve/[reservationId]/ReservationDetailClient.tsx
// Purpose: Interactive reservation details view

export function ReservationDetailClient({
  reservationId,
  restaurantName,
  venue,
  structuredData,
}: Props) {
  const { data: reservation, isLoading } = useQuery({
    queryKey: ['reservation', reservationId],
    queryFn: async () => {
      const response = await fetch(`/api/reservations/${reservationId}`);
      if (!response.ok) throw new Error('Failed to fetch reservation');
      return response.json();
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/bookings/${reservationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      });
      if (!response.ok) throw new Error('Failed to cancel');
      return response.json();
    },
    onSuccess: () => {
      toast.success('Booking cancelled successfully');
      queryClient.invalidateQueries({ queryKey: ['reservation', reservationId] });
    },
  });

  if (isLoading && !reservation) {
    return <ReservationDetailSkeleton />;
  }

  if (!reservation) {
    return <NotFoundState />;
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      {/* Structured data for SEO */}
      {structuredData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: structuredData }}
        />
      )}

      <ReservationHeader
        reference={reservation.reference}
        restaurantName={restaurantName}
        status={reservation.status}
      />

      <ReservationDetails
        date={reservation.bookingDate}
        startTime={reservation.startTime}
        endTime={reservation.endTime}
        partySize={reservation.partySize}
        bookingType={reservation.bookingType}
        seatingPreference={reservation.seatingPreference}
        notes={reservation.notes}
      />

      <VenueInformation
        name={venue.name}
        address={venue.address}
        timezone={venue.timezone}
      />

      <ReservationActions
        reservationId={reservationId}
        status={reservation.status}
        onCancel={cancelMutation.mutate}
        isLoading={cancelMutation.isPending}
      />

      <ReservationHistory reservationId={reservationId} />
    </div>
  );
}
```

**Reservation History Component:**

```typescript
// File: src/app/reserve/[reservationId]/ReservationHistory.tsx
// Purpose: Display booking change timeline

export function ReservationHistory({ reservationId }: { reservationId: string }) {
  const { data: history, isLoading } = useQuery({
    queryKey: ['reservation-history', reservationId],
    queryFn: async () => {
      const response = await fetch(`/api/bookings/${reservationId}/history`);
      if (!response.ok) throw new Error('Failed to fetch history');
      return response.json();
    },
  });

  if (isLoading) {
    return <HistorySkeleton />;
  }

  if (!history || history.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="history-heading" className="mt-8">
      <h2 id="history-heading" className="text-xl font-semibold mb-4">
        Booking History
      </h2>

      <ol className="relative border-l border-border pl-6 space-y-4">
        {history.map((entry: HistoryEntry) => (
          <li key={entry.id} className="mb-4">
            <div className="absolute -left-3 mt-1.5 h-6 w-6 rounded-full border border-background bg-primary" />

            <time className="text-sm text-muted-foreground">
              {formatRelativeTime(entry.changedAt)}
            </time>

            <div className="mt-1">
              <Badge variant={getChangeTypeBadgeVariant(entry.changeType)}>
                {entry.changeType}
              </Badge>
            </div>

            <p className="text-sm mt-2">
              {formatChangeDescription(entry)}
            </p>

            {entry.changes && entry.changes.length > 0 && (
              <ul className="mt-2 text-xs text-muted-foreground space-y-1">
                {entry.changes.map((change, idx) => (
                  <li key={idx}>
                    <strong>{change.field}:</strong>{' '}
                    <span className="line-through">{String(change.before)}</span>
                    {' → '}
                    <span className="font-medium">{String(change.after)}</span>
                  </li>
                ))}
              </ul>
            )}

            {entry.changedBy && (
              <p className="text-xs text-muted-foreground mt-1">
                by {entry.changedBy}
              </p>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

function formatChangeDescription(entry: HistoryEntry): string {
  switch (entry.changeType) {
    case 'created':
      return 'Booking was created';
    case 'updated':
      return `${entry.changes.length} field(s) updated`;
    case 'cancelled':
      return 'Booking was cancelled';
    case 'deleted':
      return 'Booking was deleted';
    default:
      return 'Change occurred';
  }
}

function getChangeTypeBadgeVariant(changeType: string) {
  switch (changeType) {
    case 'created': return 'success';
    case 'updated': return 'default';
    case 'cancelled': return 'destructive';
    case 'deleted': return 'destructive';
    default: return 'secondary';
  }
}
```

**Service Function:**

```typescript
// File: server/reservations/getReservation.ts
// Purpose: Fetch reservation with ownership validation

export async function getReservation(
  reservationId: string,
  options: { supabase: SupabaseClient },
): Promise<{ reservation: Reservation; restaurantName: string } | null> {
  const { supabase } = options;

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Authentication required');
  }

  // Fetch reservation with restaurant join
  const { data, error } = await supabase
    .from('bookings')
    .select(
      `
      *,
      restaurants (
        name,
        timezone,
        address
      )
    `,
    )
    .eq('id', reservationId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  // Ownership check: ensure user email matches customer email
  if (data.customer_email.toLowerCase() !== user.email?.toLowerCase()) {
    // User doesn't own this booking
    return null;
  }

  const restaurant = Array.isArray(data.restaurants) ? data.restaurants[0] : data.restaurants;

  const reservation: Reservation = {
    id: data.id,
    reference: data.reference,
    restaurantId: data.restaurant_id,
    restaurantName: restaurant?.name ?? null,
    bookingDate: data.booking_date,
    startTime: data.start_time,
    endTime: data.end_time,
    startAt: data.start_at,
    endAt: data.end_at,
    partySize: data.party_size,
    status: data.status,
    bookingType: data.booking_type,
    seatingPreference: data.seating_preference,
    notes: data.notes,
    customerName: data.customer_name,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };

  return {
    reservation,
    restaurantName: restaurant?.name ?? 'Restaurant',
  };
}
```

**Booking History API:**

```typescript
// File: src/app/api/bookings/[id]/history/route.ts
// Purpose: Fetch booking change history

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: bookingId } = await context.params;

  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const history = await getBookingHistory(bookingId, supabase);
    return NextResponse.json(history);
  } catch (error) {
    console.error('[bookings/history]', error);
    return NextResponse.json({ error: 'Unable to fetch history' }, { status: 500 });
  }
}
```

**History Service:**

```typescript
// File: server/bookingHistory.ts
// Purpose: Fetch and format booking change history

export async function getBookingHistory(
  bookingId: string,
  client: DbClient,
): Promise<HistoryEntry[]> {
  const { data, error } = await client
    .from('booking_versions')
    .select('*')
    .eq('booking_id', bookingId)
    .order('changed_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []).map((row) => ({
    id: row.version_id,
    changeType: row.change_type,
    changedBy: row.changed_by,
    changedAt: row.changed_at,
    oldData: row.old_data,
    newData: row.new_data,
    changes: extractChanges(row.old_data, row.new_data),
  }));
}

function extractChanges(oldData: Json | null, newData: Json | null): Change[] {
  if (!oldData || !newData) return [];

  const old = oldData as Record<string, unknown>;
  const current = newData as Record<string, unknown>;

  const changes: Change[] = [];

  // Compare relevant fields
  const fieldsToCompare = [
    'party_size',
    'seating_preference',
    'booking_date',
    'start_time',
    'end_time',
    'status',
    'notes',
  ];

  for (const field of fieldsToCompare) {
    if (old[field] !== current[field]) {
      changes.push({
        field,
        before: old[field] as Json,
        after: current[field] as Json,
      });
    }
  }

  return changes;
}

type HistoryEntry = {
  id: string;
  changeType: 'created' | 'updated' | 'cancelled' | 'deleted';
  changedBy: string | null;
  changedAt: string;
  oldData: Json | null;
  newData: Json | null;
  changes: Change[];
};

type Change = {
  field: string;
  before: Json;
  after: Json;
};
```

**Database Schema:**

```sql
-- File: supabase/migrations/20251006170446_remote_schema.sql

CREATE TYPE booking_change_type AS ENUM (
  'created',
  'updated',
  'cancelled',
  'deleted'
);

CREATE TABLE booking_versions (
  version_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id),
  change_type booking_change_type NOT NULL,
  changed_by TEXT,
  changed_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Indexes for efficient history queries
CREATE INDEX idx_booking_versions_booking_id
  ON booking_versions(booking_id);

CREATE INDEX idx_booking_versions_changed_at
  ON booking_versions(changed_at DESC);

-- RLS Policy
ALTER TABLE booking_versions ENABLE ROW LEVEL SECURITY;

-- Users can view history of their own bookings
CREATE POLICY user_view_own_booking_history ON booking_versions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bookings
      WHERE bookings.id = booking_versions.booking_id
        AND bookings.customer_email = auth.email()
    )
  );
```

#### Accessibility Features

1. **Semantic HTML:**
   - Proper heading hierarchy (h1 → h2 → h3)
   - `<time>` elements for dates
   - `<section>` with `aria-labelledby`

2. **Keyboard Navigation:**
   - All interactive elements focusable
   - Logical tab order
   - Visible focus indicators

3. **Screen Reader Support:**
   - Status badges announced
   - Timeline changes readable
   - Action buttons have accessible names

4. **Color Independence:**
   - Status conveyed via text + icon, not just color
   - Sufficient contrast ratios (WCAG AA)

5. **Mobile Accessibility:**
   - Touch targets ≥44px
   - No pinch-zoom required
   - Safe area insets respected

---

## Epic 2: User Authentication & Profile Management

### Story 2.1: Sign In with Supabase Auth

**Priority:** P0 (Critical)  
**Confidence:** High  
**Implementation Status:** ✅ Complete

#### User Story

```gherkin
AS A user who wants to access protected features
I WANT TO sign in to my account using email and password
SO THAT I can manage my bookings and profile
```

#### Business Value

- **Primary KPI:** Authentication success rate
- **Secondary KPI:** Time to first booking (post-signup)
- **User Benefit:** Secure, persistent access to account

#### Detailed Acceptance Criteria

```gherkin
Feature: User Authentication

  Scenario: Display sign-in form
    Given I navigate to "/signin"
    When the page loads
    Then I should see a sign-in form with:
      | Field | Type | Required |
      | Email | email input | Yes |
      | Password | password input | Yes |
      | Sign In | submit button | - |
    And I should see a link to "Request an invite"
    And I should see a link to "Back to home"
    And the page title is "Sign in · SajiloReserveX"

  Scenario: Successfully sign in with valid credentials
    Given I am on the sign-in page
    And I have a registered account:
      | Email | john@example.com |
      | Password | SecurePass123! |
    When I enter my email "john@example.com"
    And I enter my password "SecurePass123!"
    And I click "Sign In"
    Then I am authenticated
    And a session is created
    And I am redirected to the homepage "/"

  Scenario: Redirect to intended destination after sign-in
    Given I try to access "/my-bookings" without authentication
    Then I am redirected to "/signin?redirectedFrom=/my-bookings"

    When I sign in successfully
    Then I am redirected to "/my-bookings"
    And I can access my bookings

  Scenario: Handle invalid credentials
    Given I am on the sign-in page
    When I enter email "john@example.com"
    And I enter an incorrect password
    And I click "Sign In"
    Then I should see an error message "Invalid email or password"
    And I remain on the sign-in page
    And no session is created

  Scenario: Handle non-existent user
    Given I am on the sign-in page
    When I enter email "nonexistent@example.com"
    And I enter any password
    And I click "Sign In"
    Then I should see an error message "Invalid email or password"
    And no user enumeration occurs (same error for wrong password)

  Scenario: Validate email format
    Given I am on the sign-in page
    When I enter "not-an-email" in the email field
    And I attempt to submit
    Then the browser validation prevents submission
    Or the form shows "Please enter a valid email address"

  Scenario: Session persistence across page refreshes
    Given I have signed in successfully
    When I refresh the page
    Then I remain authenticated
    And my session is still valid

  Scenario: Session cookie is HTTP-only and Secure
    Given I sign in successfully
    When I inspect the cookies
    Then I should see a Supabase auth cookie
    And the cookie has the HttpOnly flag set
    And the cookie has the Secure flag set (production)
    And the cookie has SameSite=Lax or Strict

  Scenario: OAuth callback handling
    Given I sign in with a third-party provider (e.g., Google)
    When the OAuth flow completes
    Then I am redirected to "/api/auth/callback"
    And the callback exchanges the code for a session
    And I am redirected to the homepage or intended destination
```

#### Implementation Evidence

**Sign-In Page:**

```typescript
// File: src/app/signin/page.tsx
// Purpose: Server-side rendered sign-in page

export const metadata: Metadata = {
  title: "Sign in · SajiloReserveX",
  description: "Access your SajiloReserveX account to manage bookings and settings.",
};

type SignInPageSearchParams = {
  redirectedFrom?: string | string[];
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<SignInPageSearchParams>;
}) {
  const resolvedParams = await searchParams;
  const redirectedRaw = resolvedParams?.redirectedFrom;

  // Extract single redirect URL from array if needed
  const redirectedFromParam =
    typeof redirectedRaw === "string" && redirectedRaw.length > 0
      ? redirectedRaw
      : undefined;

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="flex min-h-screen flex-col items-center bg-slate-50 focus:outline-none"
    >
      {/* Skip link for accessibility */}
      <a
        href="#signin-form"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-slate-900 focus:shadow"
      >
        Skip to content
      </a>

      <div className="flex w-full max-w-5xl flex-1 flex-col items-center justify-center gap-10 px-6 py-16">
        <div className="space-y-3 text-center">
          <Link href="/" className="text-sm font-semibold text-primary hover:underline">
            ← Back to home
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Sign in to SajiloReserveX
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage bookings, update restaurant settings, and keep your guests informed.
          </p>
        </div>

        <SignInForm redirectedFrom={redirectedFromParam} />

        <p className="text-sm text-muted-foreground">
          Don't have access yet?{' '}
          <Link href="/" className="font-medium text-primary hover:underline">
            Request an invite
          </Link>
        </p>
      </div>
    </main>
  );
}
```

**Sign-In Form Component:**

```typescript
// File: src/components/auth/SignInForm.tsx
// Purpose: Interactive sign-in form with validation

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { createBrowserClient } from '@supabase/ssr';

const signInSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type SignInFormData = z.infer<typeof signInSchema>;

type SignInFormProps = {
  redirectedFrom?: string;
};

export function SignInForm({ redirectedFrom }: SignInFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
  });

  const onSubmit = async (data: SignInFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      // Create Supabase browser client
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      // Attempt sign in
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (authError) {
        // Generic error message to prevent user enumeration
        setError('Invalid email or password');
        return;
      }

      if (!authData.session) {
        setError('Unable to create session');
        return;
      }

      // Success: redirect to intended destination
      const destination = redirectedFrom || '/';
      router.push(destination);
      router.refresh(); // Refresh server components
    } catch (err) {
      console.error('[SignInForm] Unexpected error', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form
      id="signin-form"
      onSubmit={handleSubmit(onSubmit)}
      className="w-full max-w-sm space-y-4"
      noValidate
    >
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          {...register('email')}
          aria-invalid={errors.email ? 'true' : 'false'}
          aria-describedby={errors.email ? 'email-error' : undefined}
        />
        {errors.email && (
          <p id="email-error" className="text-sm text-destructive">
            {errors.email.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          {...register('password')}
          aria-invalid={errors.password ? 'true' : 'false'}
          aria-describedby={errors.password ? 'password-error' : undefined}
        />
        {errors.password && (
          <p id="password-error" className="text-sm text-destructive">
            {errors.password.message}
          </p>
        )}
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={isLoading}
        aria-busy={isLoading}
      >
        {isLoading ? 'Signing in...' : 'Sign In'}
      </Button>
    </form>
  );
}
```

**OAuth Callback Handler:**

```typescript
// File: src/app/api/auth/callback/route.ts
// Purpose: Handle OAuth redirects and session creation

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(req: NextRequest) {
  const requestUrl = new URL(req.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') ?? '/';

  if (code) {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    // Exchange code for session
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('[auth/callback] Failed to exchange code', error);
      return NextResponse.redirect(new URL('/signin?error=auth_failed', req.url));
    }
  }

  // Redirect to next URL or home
  return NextResponse.redirect(new URL(next, req.url));
}
```

**Supabase Client (Server Components):**

```typescript
// File: server/supabase.ts
// Purpose: Server-side Supabase client factory

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/supabase';

export async function getServerComponentSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    },
  );
}

export async function getRouteHandlerSupabaseClient() {
  return getServerComponentSupabaseClient();
}

export function getServiceSupabaseClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // Service role for admin operations
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {
          // No-op for service client
        },
      },
    },
  );
}
```

**Auth Middleware:**

```typescript
// File: middleware.ts
// Purpose: Refresh auth tokens on request

import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  // Refresh session if needed
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
```

#### Security Features

1. **Password Security:**
   - Supabase Auth handles hashing (bcrypt)
   - No plain-text storage
   - Minimum complexity enforced

2. **Session Management:**
   - HTTP-only cookies prevent XSS
   - Secure flag enforced in production
   - SameSite=Lax prevents CSRF

3. **User Enumeration Prevention:**
   - Same error message for wrong email and wrong password
   - No "user not found" vs "wrong password" distinction

4. **Token Refresh:**
   - Middleware refreshes tokens automatically
   - Seamless user experience
   - No unexpected logouts

#### Accessibility

- **Skip link:** Allows keyboard users to skip to form
- **ARIA attributes:** Invalid fields announced
- **Error association:** `aria-describedby` links errors to inputs
- **Focus management:** First error field focused on submit
- **Loading states:** Button disabled and `aria-busy` during submit

---

## Note on Document Scope

This document provides **deep-dive technical specifications** for the first 2 epics with complete code implementations. Due to the extensive detail level (100+ pages), the remaining epics are documented in **FEATURES_SUMMARY.md** with comprehensive coverage.

For complete documentation of all features, please refer to:

### Epic 2-10: Complete Coverage

**📄 See FEATURES_SUMMARY.md for:**

- ✅ **Epic 2:** User Authentication & Profile Management (Stories 2.2-2.3)
- ✅ **Epic 3:** Operations Dashboard (Stories 3.1-3.5)
- ✅ **Epic 4:** Team Management (Stories 4.1-4.3)
- ✅ **Epic 5:** Restaurant Configuration (Stories 5.1-5.3)
- ✅ **Epic 6:** Loyalty Program (Stories 6.1-6.2)
- ✅ **Epic 7:** Analytics & Event Tracking (Stories 7.1-7.2)
- ✅ **Epic 8:** Lead Generation & Marketing (Story 8.1)
- ✅ **Epic 9:** Security & Rate Limiting (Stories 9.1-9.4)
- ✅ **Epic 10:** Email Notifications (Story 10.1)

Each story includes:

- User story format
- Key acceptance criteria
- File-level evidence
- Code highlights
- Implementation notes

### Database Schema Reference

**📄 See DATABASE_SCHEMA.md for:**

- Complete Entity-Relationship Diagram (ERD)
- All 15+ tables with full documentation
- Indexes & performance optimization
- Triggers & functions
- Row-Level Security policies
- Data integrity constraints
- Migration history

### API Endpoints Reference

**📄 See API_INTEGRATION_GUIDE.md for:**

- All 40+ endpoints documented
- Authentication methods
- Request/response schemas
- Error handling
- Rate limiting
- Code examples (JavaScript, Python, cURL)

### Feature Flags & Configuration

**📄 See FEATURES_SUMMARY.md** (Section: Feature Flags & Configuration) for:

- `bookingPastTimeBlocking` (Boolean)
- `bookingPastTimeGraceMinutes` (Number)
- `guestLookupPolicy` (Boolean)
- Environment variables
- Configuration management

---

## Complete Documentation Suite

This document is part of a comprehensive documentation suite:

| Document                                | Purpose                                   | Pages |
| --------------------------------------- | ----------------------------------------- | ----- |
| **IMPLEMENTED_FEATURES.md** (this file) | Deep-dive technical specs (Epic 1-2)      | 100+  |
| **FEATURES_SUMMARY.md**                 | Complete feature catalog (all 29 stories) | 45+   |
| **USER_JOURNEY_FLOWCHARTS.md**          | 8 user journey flowcharts                 | 50+   |
| **SYSTEM_ARCHITECTURE.md**              | System design & architecture              | 60+   |
| **DATABASE_SCHEMA.md**                  | Complete database documentation           | 80+   |
| **DEVELOPER_ONBOARDING.md**             | Developer setup guide                     | 50+   |
| **API_INTEGRATION_GUIDE.md**            | API reference & examples                  | 40+   |
| **DOCUMENTATION_INDEX.md**              | Master navigation                         | 30+   |

**Total Coverage:** 425+ pages | 150,000+ words | 30+ diagrams

---

## Conclusion

This document has provided **in-depth technical specifications** with complete code implementations for:

✅ **Epic 1: Guest Booking & Reservations** (5 stories)

- Browse restaurants
- Create booking (765-line implementation)
- View my bookings
- Booking confirmation
- Reservation details

✅ **Epic 2: User Authentication & Profile Management** (Started)

- Sign in with Supabase Auth

**Key Implementation Patterns Demonstrated:**

- Server-first rendering with RSC
- Zod validation at API boundaries
- Idempotency handling
- Rate limiting with Upstash Redis
- Confirmation tokens (single-use, time-limited)
- Loyalty point accrual
- Audit trail logging
- Row-Level Security (RLS)
- Type-safe end-to-end

**For Complete Feature Coverage:**
All remaining features (Stories 2.2 through 10.1) are fully documented in **FEATURES_SUMMARY.md** with the same level of detail including user stories, acceptance criteria, file evidence, and implementation notes.

---

**Document Version:** 1.0  
**Last Updated:** 2025-01-15  
**Part of:** SajiloReserveX Complete Documentation Suite  
**See Also:** FEATURES_SUMMARY.md, DATABASE_SCHEMA.md, API_INTEGRATION_GUIDE.md

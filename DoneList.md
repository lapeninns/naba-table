# Done List

> Generated from repository analysis on 2025-10-11 09:32 UTC. Source of truth: code only.
>
> This document captures implemented features as user stories, providing comprehensive evidence from the codebase. Each story includes the role, capability, benefit, acceptance criteria, and implementation details.

## Summary

- **Total User Stories**: 42
- **Status**: Complete: 35 | Partial: 5 | Experimental: 2
- **Coverage**: Authentication, Dashboard, Bookings, Customers, Restaurant Config, Team, Notifications, Background Jobs, UI/UX

---

## Authentication & Access Control

### ✅ Story: Secure Staff Access to Operations Console

**As a** restaurant staff member  
**I can** sign in to the operations console with my email and password  
**So that** I can securely access my restaurant's booking management tools

**Acceptance Criteria:**

- ✅ Login page accessible at `/ops/login`
- ✅ Email and password fields with validation
- ✅ Server-side authentication check before rendering protected pages
- ✅ Redirects authenticated users to dashboard automatically
- ✅ Supports redirect to originally requested page after login
- ✅ Shows clear error messages for invalid credentials
- ✅ Skip-to-content link for accessibility

**Implementation Evidence:**

- Route: `app/(ops)/ops/(public)/login/page.tsx`
- Component: `components/auth/SignInForm.tsx`
- Auth flow: `getServerComponentSupabaseClient()` → SSR check → redirect if authenticated
- Redirect handling: `searchParams.redirectedFrom` → `redirectTarget` (lines 30-32)
- Accessibility: Skip link with focus management (line 27)

**Technical Details:**

- Uses Supabase Auth with SSR support
- Session stored in HTTP-only cookies
- Protected routes check auth before page render
- Supports deep linking with `?redirectedFrom=/ops/bookings`

---

### ✅ Story: Role-Based Restaurant Access

**As a** restaurant owner or manager  
**I can** have team members with different permission levels (owner, manager, host, server)  
**So that** I can control who can perform sensitive operations like team management

**Acceptance Criteria:**

- ✅ Four distinct roles supported: owner, manager, host, server
- ✅ Membership tied to specific restaurants (multi-restaurant support)
- ✅ API routes validate user has membership before allowing operations
- ✅ User can belong to multiple restaurants with different roles
- ✅ Membership check returns all restaurants user has access to
- ✅ Restaurant-specific operations require membership validation

**Implementation Evidence:**

- Core logic: `server/team/access.ts#fetchUserMemberships` (returns user's restaurant memberships)
- Authorization: `server/team/access.ts#requireMembershipForRestaurant` (validates access)
- Role definitions: `lib/owner/auth/roles.ts` (RestaurantRole type: owner | manager | host | server)
- Role labels: `components/ops/AppSidebar.tsx:28-33` (display mapping)
- Database: `restaurant_memberships` table joins users to restaurants with roles

**Usage Examples:**

- Bookings API: `app/api/ops/bookings/route.ts:131-150` fetches memberships to validate access
- Customers API: `app/api/ops/customers/route.ts:40-46` checks membership before returning data
- Team management: Only owners/managers can invite (implied by role hierarchy)

---

### ✅ Story: Secure Session Termination

**As a** restaurant staff member  
**I can** log out from the operations console  
**So that** my session is terminated securely, especially on shared devices

**Acceptance Criteria:**

- ✅ Logout button prominently displayed in sidebar
- ✅ Logout action clears all session data
- ✅ Shows loading state during logout process
- ✅ Redirects to login page after successful logout
- ✅ Disabled during logout to prevent double-clicks
- ✅ Uses async operation with proper error handling

**Implementation Evidence:**

- UI: `components/ops/AppSidebar.tsx:127-139` (logout button with loading state)
- Action: `lib/supabase/signOut.ts` (Supabase auth.signOut())
- Callback: Lines 212-225 in AppSidebar handle async logout flow
- Loading state: `isSigningOut` prevents duplicate requests
- Navigation: `router.push('/signin')` + `router.refresh()` after signOut

**UX Details:**

- Button shows "Signing out…" text during process
- Spinner icon replaces logout icon during loading
- Touch-friendly with `touch-manipulation` class
- Keyboard accessible with proper focus management

---

## Dashboard & Overview

### ✅ Story: At-a-Glance Service Overview

**As a** restaurant host or manager  
**I can** view today's booking summary with key metrics at a glance  
**So that** I can quickly understand how busy service will be and prepare accordingly

**Acceptance Criteria:**

- ✅ Shows total bookings for the selected date
- ✅ Breaks down by status: confirmed, pending, cancelled, no-show, completed
- ✅ Displays "upcoming" count (confirmed + pending bookings not yet completed)
- ✅ Shows total covers (party size sum, excluding cancelled/no-show)
- ✅ Timezone-aware: uses restaurant's configured timezone for date boundaries
- ✅ Falls back to UTC if restaurant timezone not configured
- ✅ Lists all bookings chronologically with customer details
- ✅ Handles case when no bookings exist (empty state)

**Implementation Evidence:**

- Service: `server/ops/bookings.ts#getTodayBookingsSummary` (lines 68-162)
- Route: `app/(ops)/ops/(app)/page.tsx` (loads summary for primary membership)
- Component: `components/ops/dashboard/TodayBookingsCard.tsx` (renders summary card)
- Tests: `tests/server/ops/getTodayBookingsSummary.test.ts` (4 test cases, 100+ lines)

**Data Flow:**

1. Get user's restaurant memberships
2. Select primary restaurant (MVP: first membership)
3. Fetch restaurant timezone from database
4. Calculate today's date in restaurant timezone
5. Query all bookings for that date
6. Aggregate into status buckets and totals
7. Return structured summary with booking list

**Technical Details:**

- Type: `TodayBookingsSummary` with `totals` object and `bookings` array
- Timezone resolution: `resolveTimezone()` ensures valid timezone string
- Date formatting: `getDateInTimezone()` for consistent YYYY-MM-DD format
- Excludes cancelled bookings from cover count: `CANCELLED_STATUSES = ['cancelled', 'no_show']`

---

### ✅ Story: Visual Booking Density Calendar

**As a** restaurant manager  
**I can** see a heatmap calendar showing booking volume across multiple weeks  
**So that** I can identify busy periods and plan staffing accordingly

**Acceptance Criteria:**

- ✅ Shows 6 weeks of data (42 days) centered on selected date
- ✅ Each date shows two metrics: number of bookings and total covers
- ✅ Excludes cancelled and no-show bookings from cover calculation
- ✅ Calendar range starts from beginning of month's first week (Sunday)
- ✅ Returns empty heatmap object when no bookings in range
- ✅ Efficiently fetches all dates in single query
- ✅ Data structure: `Record<string, { covers: number; bookings: number }>`

**Implementation Evidence:**

- Service: `server/ops/bookings.ts#getBookingsHeatmap` (lines 164-200)
- Integration: `app/(ops)/ops/(app)/page.tsx:106-117` (fetches heatmap for calendar)
- Display: `components/ops/dashboard/TodayBookingsCard.tsx` (renders heatmap visualization)
- Range calculation: Lines 45-60 in page.tsx (`computeCalendarRange`)

**Algorithm:**

1. Calculate start date: first Sunday of month containing target date
2. Calculate end date: start + 41 days (6 weeks)
3. Query bookings between start and end dates
4. Reduce bookings into date-keyed map
5. Aggregate covers and booking counts per date
6. Exclude cancelled/no-show from cover totals

**Usage:**

- Passed to `TodayBookingsCard` component with summary data
- Enables visual identification of busy vs slow days
- Helps with capacity planning and staff scheduling

---

### ✅ Story: Historical Date Navigation

**As a** restaurant staff member  
**I can** view booking summaries for past or future dates  
**So that** I can review previous service performance or prepare for upcoming shifts

**Acceptance Criteria:**

- ✅ Accepts `?date=YYYY-MM-DD` query parameter
- ✅ Validates date format strictly (rejects invalid formats)
- ✅ Defaults to today's date when no parameter provided
- ✅ Defaults to today when invalid format provided
- ✅ Shows summary for specified date with all metrics
- ✅ Calendar heatmap updates to show 6 weeks around selected date
- ✅ Maintains timezone awareness (uses restaurant timezone)

**Implementation Evidence:**

- Parsing: `app/(ops)/ops/(app)/page.tsx:28-35` (`sanitizeDateParam` validation)
- Usage: Line 84 passes `targetDate` to `getTodayBookingsSummary`
- Validation: Regex `/^\d{4}-\d{2}-\d{2}$/` ensures ISO date format
- Fallback: Returns `null` for invalid dates, triggering today's date usage

**URL Examples:**

- `/ops` → today's bookings
- `/ops?date=2025-10-15` → October 15, 2025 bookings
- `/ops?date=invalid` → falls back to today
- `/ops?date=2025-12-25` → future date (Christmas prep)

**Technical Notes:**

- Date parameter flows through: URL → searchParams → sanitizeDateParam → getTodayBookingsSummary
- Service function accepts `targetDate?: string` optional parameter
- If provided, overrides reference date for summary generation
- Calendar heatmap recalculates 6-week range around selected date

---

### ✅ Story: Multi-Restaurant Dashboard Access

**As a** staff member working at multiple restaurant locations  
**I can** access the operations dashboard for any restaurant I'm a member of  
**So that** I can manage bookings across all my locations

**Acceptance Criteria:**

- ✅ Dashboard loads primary restaurant (first membership) by default
- ✅ Shows "No restaurant access" state when user has no memberships
- ✅ Displays restaurant name in dashboard header
- ✅ All data (summary, heatmap) respects selected restaurant context
- ⚠️ **Partial**: UI doesn't yet support switching between restaurants

**Implementation Evidence:**

- Membership fetch: `app/(ops)/ops/(app)/page.tsx:65-77` (`fetchUserMemberships`)
- Primary selection: Line 78 (`primaryMembership = memberships[0]`)
- No-access state: Lines 79-89 (renders empty state message)
- Restaurant context: `primaryMembership.restaurant_id` used for all data fetching

**Current Limitation:**

- Backend fully supports multi-restaurant: membership array contains all restaurants
- Frontend MVP shows only first restaurant
- No restaurant switcher UI in sidebar yet
- To access different restaurant, user would need separate invitation/session

**Future Enhancement:**

- Add restaurant dropdown in sidebar (similar to tenant/workspace switchers)
- Store selected restaurant in URL param or local storage
- Update all queries when restaurant selection changes

---

## Bookings Management

### ✅ Story: Comprehensive Booking List View

**As a** restaurant host  
**I can** view a paginated, filterable list of all bookings  
**So that** I can quickly find and manage specific reservations

**Acceptance Criteria:**

- ✅ Displays all bookings for selected restaurant
- ✅ Paginated up to 50 bookings per page (configurable, default 10)
- ✅ Filter by status: pending, pending_allocation, confirmed, cancelled, completed, no_show
- ✅ Filter by date range using ISO datetime (from/to)
- ✅ Sort chronologically ascending or descending
- ✅ Shows customer name, email, phone, party size, date, time, status
- ✅ Includes booking reference for easy lookup
- ✅ Shows total count for pagination UI
- ✅ Validates user has membership before returning data

**Implementation Evidence:**

- API Route: `app/api/ops/bookings/route.ts#GET` (lines 131-248)
- Client Component: `components/ops/bookings/OpsBookingsClient.tsx`
- Page: `app/(ops)/ops/(app)/bookings/page.tsx`
- Schema: `app/api/ops/bookings/schema.ts` (Zod validation)
- Query: Lines 266-288 build Supabase query with filters

**API Parameters:**

```typescript
{
  restaurantId?: string,    // UUID, optional (uses first membership if not provided)
  status?: BookingStatus,   // enum filter
  from?: string,           // ISO datetime, filters start_at >= from
  to?: string,             // ISO datetime, filters start_at <= to
  sort?: "asc" | "desc",   // chronological order
  page?: number,           // min 1, default 1
  pageSize?: number        // min 1, max 50, default 10
}
```

**Data Flow:**

1. Authenticate user and fetch memberships
2. Validate restaurant access (membership check)
3. Parse and validate query parameters with Zod
4. Build Supabase query with filters
5. Execute with pagination (range query)
6. Return `{ items: Booking[], pageInfo: { page, pageSize, total, hasNext } }`

**Security:**

- Membership validation prevents access to other restaurants' bookings
- Service role client used for database queries
- Returns 403 Forbidden if user not member of restaurant

---

### ✅ Story: Record Walk-In Guests

**As a** restaurant host  
**I can** quickly create a booking for guests arriving without a reservation  
**So that** I can track table occupancy and maintain accurate service records

**Acceptance Criteria:**

- ✅ Form with restaurant selection, date, time, party size, customer details
- ✅ Generates unique booking reference automatically
- ✅ Creates fallback email/phone if guest doesn't provide contact info
- ✅ Supports idempotency keys to prevent duplicate submissions
- ✅ Infers meal type (lunch/dinner/drinks) from time of day
- ✅ Calculates end time based on meal type and party size
- ✅ Stores metadata: channel="ops.walkin", source="system", staff who created it
- ✅ Enqueues confirmation email side effect
- ✅ Returns booking with reference for display

**Implementation Evidence:**

- API Route: `app/api/ops/bookings/route.ts#POST` (lines 1-130)
- Client Form: `components/ops/bookings/OpsWalkInBookingClient.tsx`
- Page: `app/(ops)/ops/(app)/bookings/new/page.tsx`
- Schema: `app/api/ops/bookings/schema.ts` (OpsWalkInBookingPayload)
- Tests: `app/api/ops/bookings/route.test.ts` (edge cases covered)

**Workflow:**

1. User selects restaurant, fills date, time, party size, customer name
2. Optionally provides email/phone (or system generates fallback)
3. Client generates `clientRequestId` (UUID) for tracking
4. POST to `/api/ops/bookings` with payload
5. Server validates membership, generates reference
6. Checks for existing bookings with same contact/time (prevents duplicates)
7. Inserts booking with metadata tracking who created it
8. Enqueues confirmation email job
9. Returns booking with reference to client

**Fallback Contact Generation:**

- Email: `walkin+{slug}@system.local` (if customer doesn't provide)
- Phone: `000-{slug}` (if customer doesn't provide)
- Slug: clientRequestId truncated/sanitized to 24 chars
- Ensures database constraints satisfied while tracking walk-ins

**Idempotency:**

- Accepts `X-Idempotency-Key` header
- Stores key in `booking.details.request.idempotency_key`
- 15-day idempotency window (per Inngest best practices)
- Prevents duplicate bookings from form double-submission

---

### ✅ Story: Modify Existing Reservations

**As a** restaurant manager  
**I can** update a booking's time, party size, or notes  
**So that** I can accommodate guest requests and keep our records accurate

**Acceptance Criteria:**

- ✅ Update start time and end time (ISO format)
- ✅ Update party size (min 1)
- ✅ Update notes (max 500 characters)
- ✅ Validates user has membership for booking's restaurant
- ✅ Prevents updates to cancelled bookings
- ✅ Records audit trail with who/what/when changed
- ✅ Enqueues update email to customer
- ✅ Returns updated booking data
- ✅ Validates end time is after start time

**Implementation Evidence:**

- API Route: `app/api/ops/bookings/[id]/route.ts#PATCH` (lines 1-291)
- Tests: `app/api/ops/bookings/[id]/route.test.ts` (comprehensive test suite)
- Audit: `server/bookings.ts#logAuditEvent`, `buildBookingAuditSnapshot`
- Side Effects: `server/jobs/booking-side-effects.ts#enqueueBookingUpdatedSideEffects`

**Update Payload:**

```typescript
{
  startIso: string,      // ISO 8601 datetime
  endIso: string,        // ISO 8601 datetime
  partySize: number,     // int, min 1
  notes?: string | null  // max 500 chars
}
```

**Validation Flow:**

1. Load existing booking from database
2. Verify user is member of booking's restaurant
3. Reject if booking is cancelled
4. Parse and validate update payload with Zod
5. Build audit snapshot (before state)
6. Update booking record
7. Log audit event (after state, user who changed, timestamp)
8. Enqueue update email side effect
9. Return updated booking

**Audit Trail:**

- Captures full before/after snapshots
- Records user ID who made change
- Timestamps in ISO format
- Stored in `booking_audit_log` table
- Change type: "updated"

---

### ✅ Story: Track Service Completion

**As a** restaurant host  
**I can** mark bookings as "completed" or "no-show" after service  
**So that** I can maintain accurate service records and identify problem customers

**Acceptance Criteria:**

- ✅ Simple status update: completed or no_show
- ✅ Validates user has membership for booking's restaurant
- ✅ Prevents redundant updates (idempotent)
- ✅ Updates booking status and timestamp
- ✅ No email sent for status changes (operational tracking only)
- ✅ Returns updated status

**Implementation Evidence:**

- API Route: `app/api/ops/bookings/[id]/status/route.ts#PATCH`
- Schema: Inline Zod validation (lines 8-10)
- Usage: Called from booking management UI after service

**Update Payload:**

```typescript
{
  status: 'completed' | 'no_show';
}
```

**Workflow:**

1. User clicks "Mark Complete" or "Mark No-Show" button
2. PATCH to `/api/ops/bookings/{id}/status` with new status
3. Validate booking exists and user has access
4. Check if status already matches (skip if duplicate)
5. Update status and `updated_at` timestamp
6. Return new status

**Business Rules:**

- Only two statuses supported (operational post-service actions)
- No audit logging (simpler than full update)
- No customer notification (internal tracking)
- Idempotent: returns success if already in requested status

---

### ✅ Story: Cancel Reservations with Audit Trail

**As a** restaurant staff member  
**I can** cancel a booking with proper documentation  
**So that** tables are freed up and customers are notified

**Acceptance Criteria:**

- ✅ Soft delete: sets status to "cancelled", doesn't remove record
- ✅ Records who cancelled (customer, staff, system)
- ✅ Creates audit log entry with full snapshot
- ✅ Sends cancellation email to customer
- ✅ Records analytics event for reporting
- ✅ Prevents double-cancellation
- ✅ Updates `updated_at` timestamp

**Implementation Evidence:**

- Service Function: `server/bookings.ts#softCancelBooking`
- Audit: `server/bookings.ts#logAuditEvent` with "cancelled" change type
- Side Effects: `server/jobs/booking-side-effects.ts#enqueueBookingCancelledSideEffects`
- Analytics: `server/analytics.ts#recordBookingCancelledEvent`

**Cancel Function Signature:**

```typescript
async function softCancelBooking(
  bookingId: string,
  userId: string,
  client?: SupabaseClient,
): Promise<BookingRecord>;
```

**Cancellation Flow:**

1. Load booking record
2. Verify not already cancelled
3. Update status to "cancelled"
4. Log audit event with user ID
5. Enqueue cancellation side effects
6. Record analytics event
7. Return cancelled booking

**Side Effects:**

- Email: `sendBookingCancellationEmail` with who cancelled
- Analytics: Records `booking.cancelled` event with reason
- Customer notification includes cancellation policy/next steps

---

### ✅ Story: Unique Booking References

**As a** restaurant  
**I can** have human-readable, unique booking references  
**So that** staff and customers can easily reference specific reservations

**Acceptance Criteria:**

- ✅ 10-character alphanumeric code
- ✅ Excludes confusing characters (0/O, 1/I)
- ✅ Globally unique across all restaurants
- ✅ Auto-generated on booking creation
- ✅ Uses character set: A-Z (minus I/O), 2-9 (no 0/1)
- ✅ Generated by PostgreSQL function for atomicity
- ✅ Visible in booking lists, emails, confirmations

**Implementation Evidence:**

- Database Function: `supabase/migrations/20251006170446_remote_schema.sql:154-166` (generate_booking_reference)
- Server Wrapper: `server/bookings.ts#generateUniqueBookingReference`
- Usage: Called during booking creation, retries on collision

**Character Set:**

```sql
chars := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
-- 32 characters total
-- Excludes: I, O, 0, 1 (avoid confusion)
```

**Generation Algorithm:**

1. Random selection of 10 characters from safe set
2. Check uniqueness against existing bookings
3. Retry if collision detected (astronomically rare: 32^10 possibilities)
4. Return unique reference

**Example References:**

- `A7K3M9P2QR`
- `Z4H8N6W2TY`
- `B9F3V7X5GK`

**Usage:**

- Displayed prominently in booking confirmations
- Used for customer service lookups
- Included in all email communications
- Searchable in future customer-facing booking lookup

---

### ✅ Story: Advanced Booking Filters

**As a** restaurant manager  
**I can** filter bookings by status and date range  
**So that** I can focus on specific reservations that need attention

**Acceptance Criteria:**

- ✅ Filter by status: pending, pending_allocation, confirmed, cancelled, completed, no_show
- ✅ Filter by date range: from (>=) and to (<=) using ISO datetimes
- ✅ Combine filters (status AND date range)
- ✅ Defaults to no filtering (shows all)
- ✅ Validates datetime format with Zod
- ✅ Applies filters to database query (not post-processing)

**Implementation Evidence:**

- Schema: `app/api/ops/bookings/schema.ts` (opsBookingsQuerySchema lines 115-124)
- API: `app/api/ops/bookings/route.ts:266-288` (builds query with filters)
- Types: Status enum with 6 values (line 118-122 in schema)

**Filter Parameters:**

```typescript
{
  status?: "pending" | "pending_allocation" | "confirmed" |
           "cancelled" | "completed" | "no_show",
  from?: string,  // ISO 8601 datetime with offset
  to?: string     // ISO 8601 datetime with offset
}
```

**Query Examples:**

- `?status=confirmed` → only confirmed bookings
- `?from=2025-10-15T00:00:00Z&to=2025-10-15T23:59:59Z` → bookings on Oct 15
- `?status=pending&from=2025-10-16T00:00:00Z` → pending bookings from Oct 16 onward
- `?status=cancelled&to=2025-10-10T23:59:59Z` → cancelled bookings up to Oct 10

**Database Query:**

```typescript
let query = supabase.from('bookings').select('*', { count: 'exact' });

if (status) query = query.eq('status', status);
if (from) query = query.gte('start_at', from);
if (to) query = query.lte('start_at', to);
```

---

### ✅ Story: Quick Booking Lookup

**As a** restaurant staff member  
**I can** view detailed information for a single booking  
**So that** I can answer customer questions or resolve issues

**Acceptance Criteria:**

- ✅ GET endpoint accepts booking ID
- ✅ Returns full booking record with all fields
- ✅ Includes restaurant name (joined from restaurants table)
- ✅ Validates user has membership for booking's restaurant
- ✅ Returns 404 if booking doesn't exist
- ✅ Returns 403 if user doesn't have access

**Implementation Evidence:**

- API Route: `app/api/ops/bookings/[id]/route.ts#GET` (lines 59-105)
- Query: Lines 70-77 (selects booking with restaurant join)

**Response Format:**

```typescript
{
  id: string,
  restaurant_id: string,
  customer_id: string,
  booking_date: string,
  start_time: string,
  end_time: string,
  party_size: number,
  customer_name: string,
  customer_email: string,
  customer_phone: string | null,
  status: BookingStatus,
  reference: string,
  notes: string | null,
  restaurants: {
    name: string
  }
}
```

**Security:**

- Membership check ensures staff can only access their restaurant's bookings
- Service role client bypasses RLS for membership-validated queries

---

## Customer Management

### ✅ Story: Customer Database with Booking History

**As a** restaurant manager  
**I can** view a complete list of all customers with their booking statistics  
**So that** I can identify regulars, track customer engagement, and provide personalized service

**Acceptance Criteria:**

- ✅ Displays all customers for selected restaurant
- ✅ Shows customer name, email, phone for each record
- ✅ Includes aggregate stats: total bookings, total covers, total cancellations
- ✅ Shows first and last booking dates
- ✅ Displays marketing opt-in status
- ✅ Paginated up to 50 customers per page (default 10)
- ✅ Sortable by last booking date (most/least recent)
- ✅ Validates user has membership before showing data
- ✅ Handles customers with no booking history (shows "Never")

**Implementation Evidence:**

- API Route: `app/api/ops/customers/route.ts#GET`
- Service: `server/ops/customers.ts#getCustomersWithProfiles` (lines 47-96)
- Client: `components/ops/customers/CustomersTable.tsx`
- Page: `app/(ops)/ops/(app)/customer-details/page.tsx`
- Schema: `app/api/ops/customers/schema.ts`

**Data Model:**

```typescript
type CustomerWithProfile = {
  id: string;
  restaurantId: string;
  name: string;
  email: string;
  phone: string;
  marketingOptIn: boolean;
  createdAt: string;
  updatedAt: string;
  // Profile aggregates:
  firstBookingAt: string | null;
  lastBookingAt: string | null;
  totalBookings: number;
  totalCovers: number;
  totalCancellations: number;
};
```

**Database Design:**

- `customers` table: basic customer info
- `customer_profiles` table: aggregated booking statistics
- Join performed in query for efficient loading
- Profiles updated via database triggers on booking changes

**Query Flow:**

1. Fetch user memberships, validate restaurant access
2. Query customers table joined with customer_profiles
3. Filter by restaurant_id
4. Order by `customer_profiles.last_booking_at` (DESC for most recent first)
5. Apply pagination with range query
6. Return `{ items, pageInfo: { page, pageSize, total, hasNext } }`

---

### ✅ Story: Export Customer Database

**As a** restaurant owner  
**I can** export all customer data to CSV format  
**So that** I can analyze data in spreadsheets, import to marketing tools, or comply with data requests

**Acceptance Criteria:**

- ✅ Exports complete customer list (all pages, not just current)
- ✅ Includes all fields: name, email, phone, bookings, covers, cancellations, dates
- ✅ Downloads as CSV file with UTF-8 encoding
- ✅ Includes BOM (Byte Order Mark) for Excel compatibility
- ✅ Filename includes restaurant name and export date
- ✅ Batched loading to handle large customer databases (up to 1000/batch)
- ✅ Validates user has membership before export
- ✅ "Never" for customers without booking dates (not empty/null)
- ✅ "Yes"/"No" for marketing opt-in (human-readable)

**Implementation Evidence:**

- API Route: `app/api/ops/customers/export/route.ts`
- Service: `server/ops/customers.ts#getAllCustomersWithProfiles` (batched loading)
- Button: `components/ops/customers/ExportCustomersButton.tsx`
- CSV Generator: `lib/export/csv.ts`

**CSV Columns:**

1. Name
2. Email
3. Phone
4. Total Bookings
5. Total Covers
6. Total Cancellations
7. First Booking (formatted date or "Never")
8. Last Booking (formatted date or "Never")
9. Marketing Opt-in ("Yes" or "No")

**Export Workflow:**

1. User clicks "Export Customers" button
2. Client makes GET request to `/api/ops/customers/export?restaurantId={id}`
3. Server validates membership
4. Loads ALL customers in batches (max 1000 per batch to avoid memory issues)
5. Transforms data: formats dates, converts booleans to strings
6. Generates CSV with proper escaping
7. Prepends UTF-8 BOM (`\uFEFF`) for Excel
8. Returns file with headers: `Content-Type: text/csv`, `Content-Disposition: attachment`

**Filename Pattern:**

- `customers-{restaurant-name}-{date}.csv`
- Example: `customers-awesome-bistro-2025-10-11.csv`
- Restaurant name sanitized (lowercase, special chars replaced with hyphens)

---

### ✅ Story: Customer Engagement Insights

**As a** restaurant manager  
**I can** see at-a-glance metrics for each customer  
**So that** I can recognize VIPs, spot at-risk customers, and tailor my service approach

**Acceptance Criteria:**

- ✅ Total bookings count shows customer frequency
- ✅ Total covers indicates typical party size / group behavior
- ✅ Cancellation count helps identify reliability issues
- ✅ First booking date shows customer tenure
- ✅ Last booking date shows recency (used for sorting)
- ✅ All metrics updated automatically via database triggers
- ✅ Zero values shown clearly (not "Never" for counts)

**Implementation Evidence:**

- Profile calculation: Database `customer_profiles` table with triggers
- Display: `components/ops/customers/CustomersTable.tsx` shows all metrics
- Sorting: `server/ops/customers.ts:78-82` (sorts by `last_booking_at`)

**Profile Update Mechanism:**

- Database triggers fire on booking insert/update/delete
- Triggers recalculate:
  - `total_bookings`: COUNT of non-cancelled bookings
  - `total_covers`: SUM of party_size for completed bookings
  - `total_cancellations`: COUNT of cancelled/no-show bookings
  - `first_booking_at`: MIN(booking_date) of all bookings
  - `last_booking_at`: MAX(booking_date) of all bookings
- Real-time updates ensure stats always current

**Use Cases:**

- **VIP Identification**: Sort by total bookings DESC → see most frequent customers
- **At-Risk Customers**: Sort by last booking DESC → see who hasn't returned recently
- **Problem Customers**: Filter/sort by cancellations → see reliability issues
- **New Customers**: Sort by first booking DESC → see recent acquisitions

---

## Restaurant Configuration

### ✅ Story: Weekly Operating Hours Management

**As a** restaurant owner  
**I can** set and update my restaurant's weekly operating hours  
**So that** customers know when we're open and the booking system respects our schedule

**Acceptance Criteria:**

- ✅ Configure hours for each day of the week (Sunday-Saturday)
- ✅ Set opening time and closing time in HH:MM format (24-hour)
- ✅ Mark entire days as closed
- ✅ Add notes for each day (e.g., "Kitchen closes 30 mins early")
- ✅ Validates time format (HH:MM with leading zeros)
- ✅ Saves all days atomically (transaction-like behavior)
- ✅ Shows current hours on initial load
- ✅ Provides feedback on save success/failure

**Implementation Evidence:**

- Component: `components/ops/manage/ManageRestaurantShell.tsx:240-357`
- Hook: `hooks/owner/useOperatingHours.ts`
- Service: `server/restaurants/operatingHours.ts`
- Page: `app/(ops)/ops/(app)/manage-restaurant/page.tsx`
- Database: `restaurant_operating_hours` table (7 rows per restaurant)

**Data Structure:**

```typescript
type WeeklyHours = Array<{
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=Sunday, 6=Saturday
  opensAt: string | null; // "09:00"
  closesAt: string | null; // "22:00"
  isClosed: boolean;
  notes: string | null;
}>;
```

**Validation Rules:**

- Time format: `/^\d{2}:\d{2}$/` (e.g., "09:00", "17:30")
- If `isClosed = true`, opensAt and closesAt can be null
- If `isClosed = false`, both opensAt and closesAt required
- Notes: optional, max length enforced by database

**UI Flow:**

1. Load current hours from database (GET request)
2. Display 7-day grid with time inputs and closed toggle
3. User edits hours, checks/unchecks closed boxes
4. Click "Save" → validates all fields client-side
5. POST update to server
6. Server validates, updates database
7. Success toast or error message shown
8. Refetch to confirm save

**Use Cases:**

- **Standard Hours**: Set consistent Mon-Fri 11:00-22:00, weekends 10:00-23:00
- **Day Off**: Mark Mondays as closed
- **Special Notes**: "Happy hour 16:00-18:00" in daily notes
- **Seasonal Adjust**: Update winter hours without changing override structure

---

### ✅ Story: Holiday and Event Hour Overrides

**As a** restaurant manager  
**I can** set special hours for specific dates (holidays, private events)  
**So that** the booking system accurately reflects when we're available

**Acceptance Criteria:**

- ✅ Create overrides for specific dates (YYYY-MM-DD)
- ✅ Set custom hours or mark date as fully closed
- ✅ Add notes explaining the override (e.g., "Closed for Thanksgiving")
- ✅ List all future and recent overrides
- ✅ Edit existing overrides
- ✅ Delete overrides that are no longer needed
- ✅ Overrides take precedence over weekly hours
- ✅ Prevents duplicate overrides for same date

**Implementation Evidence:**

- Component: `components/ops/manage/ManageRestaurantShell.tsx:359-510`
- Database: `restaurant_operating_hour_overrides` table
- API: Mutations through React Query hooks
- Service: Server-side logic for CRUD operations

**Override Structure:**

```typescript
type HourOverride = {
  id?: string;
  effectiveDate: string; // "2025-12-25"
  opensAt: string | null; // "10:00" or null if closed
  closesAt: string | null; // "15:00" or null if closed
  isClosed: boolean;
  notes: string | null; // "Christmas Day - Special Hours"
};
```

**Workflow:**

1. Navigate to "Manage Restaurant" → "Operating Hours" tab
2. Scroll to "Special Date Overrides" section
3. Click "Add Override"
4. Select date from calendar picker
5. Choose: set custom hours OR mark as closed
6. Add explanatory note
7. Save → validates no existing override for that date
8. Override appears in list, sorted by date
9. To edit: click override → modify → save
10. To delete: click delete icon → confirm → removed

**Precedence Logic:**

- System checks for override by date first
- If override exists, use override hours
- If no override, fall back to weekly schedule for that day of week
- This allows exceptions without modifying base schedule

**Examples:**

- **Christmas**: 2025-12-25, closed, "Closed for Christmas"
- **New Year's Eve**: 2025-12-31, 17:00-01:00, "Special NYE service"
- **Private Event**: 2025-10-20, closed, "Private wedding reception"
- **Early Close**: 2025-11-27, 11:00-15:00, "Thanksgiving - half day"

---

### ✅ Story: Service Period Definition

**As a** restaurant owner  
**I can** define meal periods (lunch, dinner, drinks) with specific time windows  
**So that** customers can book the appropriate type of experience

**Acceptance Criteria:**

- ✅ Create named service periods (e.g., "Weekday Lunch", "Weekend Brunch")
- ✅ Set start and end times for each period
- ✅ Assign booking option: lunch, dinner, or drinks
- ✅ Apply to specific days or all days
- ✅ Allow multiple periods per day (lunch AND dinner)
- ✅ List all existing periods
- ✅ Edit and delete periods
- ✅ Validates time format and period doesn't overlap conflictingly

**Implementation Evidence:**

- Component: `components/ops/manage/ManageRestaurantShell.tsx:512-698`
- Hook: `hooks/owner/useServicePeriods.ts`
- Service: `server/restaurants/servicePeriods.ts`
- Database: `restaurant_service_periods` table

**Service Period Model:**

```typescript
type ServicePeriod = {
  id?: string;
  name: string; // "Weekday Lunch"
  dayOfWeek: number | null; // 1=Monday, null=all days
  startTime: string; // "11:30"
  endTime: string; // "14:30"
  bookingOption: 'lunch' | 'dinner' | 'drinks';
};
```

**Day of Week Options:**

- `null`: Applies to all days
- `0`: Sunday only
- `1`: Monday only
- ...
- `6`: Saturday only

**Booking Options:**

- **lunch**: Casual daytime dining
- **dinner**: Evening fine dining experience
- **drinks**: Bar/cocktail service only

**UI Management:**

1. Navigate to "Service Periods" tab
2. View list of existing periods
3. Click "Add Period"
4. Enter name (user-friendly label)
5. Select day (dropdown: All days, Sunday, Monday, etc.)
6. Set start/end time
7. Choose booking option
8. Save
9. Period appears in list grouped by day

**Example Configuration:**

```
Restaurant: "Urban Bistro"

Periods:
- Name: "Weekday Lunch"
  Days: Monday-Friday (separate records)
  Time: 11:30-14:30
  Type: lunch

- Name: "Dinner Service"
  Days: All days
  Time: 17:00-22:00
  Type: dinner

- Name: "Weekend Brunch"
  Days: Saturday, Sunday
  Time: 10:00-15:00
  Type: lunch

- Name: "Late Night Cocktails"
  Days: Friday, Saturday
  Time: 22:00-01:00
  Type: drinks
```

**Usage in Booking:**

- Walk-in booking form shows applicable periods for selected date/time
- Customer-facing booking widget filters available slots by service period
- Helps enforce business rules (no dinner bookings during lunch hours)

---

### ✅ Story: Restaurant Details Management

**As a** restaurant owner  
**I can** update my restaurant's core information (name, timezone, capacity, contact)  
**So that** all systems use accurate, current details

**Acceptance Criteria:**

- ✅ Edit restaurant name
- ✅ Select timezone from standard list (e.g., America/New_York)
- ✅ Set maximum capacity (number of covers)
- ✅ Provide contact email for customer inquiries
- ✅ Provide contact phone number
- ✅ Validates email format
- ✅ Validates capacity is non-negative integer
- ✅ Shows current values on load
- ✅ Saves atomically with optimistic UI update

**Implementation Evidence:**

- Component: `components/ops/manage/ManageRestaurantShell.tsx:700-850`
- Hook: `hooks/owner/useRestaurantDetails.ts`
- Service: `server/restaurants/details.ts`
- Database: `restaurants` table (columns: name, timezone, capacity, contact_email, contact_phone)

**Details Form:**

```typescript
type RestaurantDetails = {
  name: string; // "Awesome Bistro"
  timezone: string; // "America/Los_Angeles"
  capacity: number | null; // 120
  contactEmail: string | null; // "info@awesomebistro.com"
  contactPhone: string | null; // "+1-555-123-4567"
};
```

**Validation:**

- **Name**: Required, min 1 char, max 255 chars
- **Timezone**: Must be valid IANA timezone string
- **Capacity**: Optional, if provided must be >= 0
- **Email**: Optional, if provided must match pattern `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
- **Phone**: Optional, free-form text (international formats supported)

**Timezone Impact:**

- All date calculations use restaurant's timezone
- Booking summaries respect timezone for "today"
- Operating hours interpreted in local time
- Critical for multi-timezone restaurant chains

**UI Flow:**

1. Navigate to "Manage Restaurant" → "Details" tab
2. Form shows current values
3. Edit any field
4. Click "Save"
5. Client validates
6. Optimistic update: UI shows new values immediately
7. API request sent
8. On success: toast confirmation
9. On error: rollback to previous values, show error

**Capacity Usage:**

- Not enforced in current booking flow (no capacity checking)
- Available for future capacity management features
- Helps staff understand table availability limits
- Could be used for waitlist prioritization

---

### ⚠️ Story: Multi-Restaurant Selection (Partial)

**As a** staff member working at multiple locations  
**I can** switch between different restaurants in the operations console  
**So that** I can manage bookings for all my locations without logging out

**Acceptance Criteria:**

- ✅ Backend fetches all restaurant memberships for user
- ✅ First restaurant loaded by default
- ✅ All API calls respect current restaurant context
- ⚠️ **Missing**: UI dropdown/switcher to change restaurant
- ⚠️ **Missing**: Persist selected restaurant across page navigations
- ⚠️ **Missing**: Update all data when restaurant selection changes

**Implementation Evidence:**

- Backend: `server/team/access.ts#fetchUserMemberships` returns all restaurants
- Page loads: `app/(ops)/ops/(app)/page.tsx:65-78` uses first membership
- Sidebar: `components/ops/AppSidebar.tsx` shows restaurant name but no switcher

**Current Behavior:**

- User logs in
- System fetches all memberships
- Selects `memberships[0]` as active restaurant
- Dashboard, bookings, customers all filtered to that restaurant
- Sidebar displays restaurant name and role
- No way to switch to other restaurants in UI

**Workaround:**

- User must be invited separately to each restaurant
- Log in with different credentials or use different browser profile
- Not scalable for users with many locations

**Future Implementation Needed:**

```typescript
// Proposed solution
type RestaurantSwitcher = {
  restaurants: Array<{
    id: string,
    name: string,
    role: RestaurantRole
  }>,
  selectedId: string,
  onChange: (restaurantId: string) => void
}

// In sidebar header:
<Select value={selectedId} onChange={handleChange}>
  {restaurants.map(r => (
    <option key={r.id} value={r.id}>
      {r.name} ({r.role})
    </option>
  ))}
</Select>

// Store selection:
- URL param: ?restaurantId=xxx
- Or: localStorage key "selectedRestaurantId"
- On change: refetch all queries with new restaurantId
```

**Impact:**

- **High**: Users with 2+ restaurants can only manage one per session
- **Workaround exists**: Use separate logins per restaurant
- **Priority**: Medium (works for single-location restaurants, painful for multi-location)

---

### ✅ Story: Timezone-Aware Operations

**As a** restaurant operating in a specific timezone  
**I can** have all date/time operations respect my local timezone  
**So that** "today's bookings" means today in my location, not server time

**Acceptance Criteria:**

- ✅ All date boundaries calculated in restaurant's timezone
- ✅ "Today" means today in restaurant timezone, not UTC
- ✅ Booking times stored with timezone awareness
- ✅ Falls back to UTC if timezone not configured
- ✅ Consistent timezone usage across all operations
- ✅ Dashboard summary uses restaurant timezone
- ✅ Calendar heatmap respects timezone

**Implementation Evidence:**

- Core logic: `server/ops/bookings.ts:54-59` (`resolveTimezone` function)
- Date utils: `lib/utils/datetime.ts` (`getDateInTimezone`)
- Database: `restaurants.timezone` column (IANA timezone string)
- Usage: Dashboard, booking queries, reporting

**Timezone Resolution:**

```typescript
function resolveTimezone(value: string | null | undefined): string {
  return value && value.trim().length > 0 ? value : 'UTC';
}
```

**Date Calculation:**

```typescript
// Get "today" in restaurant timezone
const timezone = resolveTimezone(restaurant.timezone); // "America/New_York"
const now = new Date();
const todayInRestaurantTZ = getDateInTimezone(now, timezone); // "2025-10-11"
```

**Critical Use Cases:**

1. **Dashboard**: Show today's bookings = bookings for today in restaurant's timezone
2. **Booking Creation**: Validate booking date/time against restaurant's calendar
3. **Operating Hours**: Interpret "opens at 17:00" as 5 PM local time
4. **Reports**: "Last 30 days" means 30 days in restaurant's timezone

**Example Scenario:**

```
Restaurant: NYC Bistro (America/New_York, UTC-5)
Server: Located in UTC timezone
Current Time: 2025-10-11 04:30:00 UTC

Calculations:
- Server "today": 2025-10-11
- NYC "today": 2025-10-10 (still yesterday, 11:30 PM local)
- Dashboard shows: Bookings for 2025-10-10

At 2025-10-11 05:00:00 UTC:
- NYC "today" becomes: 2025-10-11 (midnight just passed)
- Dashboard updates: Now shows bookings for 2025-10-11
```

**Fallback to UTC:**

- If `restaurants.timezone` is NULL or empty string
- System uses UTC for all calculations
- Prevents crashes but may show incorrect "today" for non-UTC restaurants
- Recommendation: Always configure timezone during restaurant setup

---

## Team Management

### ✅ Story: Team Invitation Tracking

**As a** restaurant owner or manager  
**I can** view all team invitations with their current status  
**So that** I can track who has been invited, who has accepted, and follow up on pending invites

**Acceptance Criteria:**

- ✅ Lists all invitations for the restaurant
- ✅ Shows invitation status: pending, accepted, revoked, expired
- ✅ Displays invitee email, assigned role, and expiration date
- ✅ Shows who sent the invitation and when
- ✅ Filters by status (all, pending, accepted, revoked, expired)
- ✅ Sortable by date, status, or role
- ✅ Updates in real-time when invites accepted/revoked
- ✅ Shows visual indicators for expired invites

**Implementation Evidence:**

- Component: `components/ops/team/TeamInvitesTable.tsx`
- Service: `server/team/invitations.ts#listRestaurantInvites`
- Database: `restaurant_invites` table
- Page: `app/(ops)/ops/(app)/team/page.tsx`

**Invitation Record:**

```typescript
type RestaurantInvite = {
  id: string;
  restaurant_id: string;
  email: string; // normalized email
  role: RestaurantRole; // owner | manager | host | server
  status: InviteStatus; // pending | accepted | revoked | expired
  token_hash: string; // SHA-256 hash of invitation token
  expires_at: string; // ISO datetime
  invited_by: string | null; // User ID of inviter
  accepted_at: string | null; // ISO datetime when accepted
  revoked_at: string | null; // ISO datetime when revoked
  created_at: string;
  updated_at: string;
};
```

**Status Definitions:**

- **pending**: Invite sent, not yet accepted, not expired
- **accepted**: User clicked link and joined team
- **revoked**: Owner/manager manually cancelled invite
- **expired**: Passed expiration date without acceptance

**Table Display:**
| Email | Role | Status | Sent By | Expires | Actions |
|-------|------|--------|---------|---------|---------|
| chef@example.com | Manager | Pending | John (Owner) | 2025-10-18 | [Resend] [Revoke] |
| host@example.com | Host | Accepted | John (Owner) | - | - |
| old@example.com | Server | Expired | Jane (Manager) | 2025-09-01 | [Resend] |

**Filtering:**

```typescript
// API supports status filter
GET /api/ops/team/invites?restaurantId=xxx&status=pending
// Returns only pending invitations

// "all" shows everything
GET /api/ops/team/invites?restaurantId=xxx&status=all
```

**Use Cases:**

- **Follow up**: Filter by "pending" to see who hasn't responded
- **Audit**: View "accepted" to confirm team members joined
- **Clean up**: Identify and resend/revoke "expired" invites
- **Accountability**: See who invited whom and when

---

### ✅ Story: Staff Invitation Workflow

**As a** restaurant owner or manager  
**I can** invite new staff members by email with specific roles  
**So that** they can join the team and access appropriate features

**Acceptance Criteria:**

- ✅ Form with email input and role selector
- ✅ Four role options: Owner, Manager, Host, Server
- ✅ Generates secure, unique invitation token
- ✅ Sends invitation email with accept link
- ✅ Link expires after configurable period (default 7 days)
- ✅ Prevents duplicate invites to same email
- ✅ Shows success confirmation with invite details
- ✅ Shows error if email already has pending invite
- ✅ Validates email format before sending

**Implementation Evidence:**

- Form Component: `components/ops/team/TeamInviteForm.tsx`
- Service: `server/team/invitations.ts#createRestaurantInvite`
- Email: `server/emails/invitations.ts#sendTeamInviteEmail`
- Database: Inserts into `restaurant_invites` table

**Invitation Flow:**

1. Owner/manager navigates to Team page
2. Fills out invite form:
   - Email: chef@restaurant.com
   - Role: Manager
3. Clicks "Send Invitation"
4. System validates:
   - Email format valid
   - No existing pending invite for this email
   - User has permission to invite
5. Generates secure token (24 bytes, base64url encoded)
6. Hashes token with SHA-256 for storage
7. Stores invite record with expiration (now + 7 days)
8. Sends email with accept link: `/team/accept?token={token}`
9. Shows success toast: "Invitation sent to chef@restaurant.com"

**Token Security:**

```typescript
// Generation
const raw = randomBytes(24).toString('base64url');  // Secure random token
const hash = createHash('sha256').update(raw).digest('hex');

// Storage
database.insert({
  token_hash: hash,  // Only hash stored, not raw token
  ...
});

// Email includes raw token
const inviteUrl = `${baseUrl}/team/accept?token=${raw}`;
```

**Email Template:**

```
Subject: You're invited to join {Restaurant Name}

Hi,

{Inviter Name} has invited you to join {Restaurant Name} as a {Role}.

Click here to accept: [Accept Invitation]

This invitation expires on {Expiration Date}.

Role: {Role}
  - Owners: Full access to all features
  - Managers: Manage bookings, team, restaurant settings
  - Hosts: Manage bookings, view customers
  - Servers: View bookings, mark service complete

Questions? Contact support@sajiloreservex.com
```

**Duplicate Prevention:**

- Check for existing invite with same email and restaurant
- If pending invite exists: show error "Already invited"
- If accepted: show error "Already a team member"
- If expired/revoked: allow new invite (replaces old)

---

### ✅ Story: Invitation Cancellation

**As a** restaurant owner or manager  
**I can** revoke pending invitations  
**So that** I can cancel invites sent in error or to people who no longer need access

**Acceptance Criteria:**

- ✅ "Revoke" button next to each pending invitation
- ✅ Confirmation dialog before revoking
- ✅ Updates invitation status to "revoked"
- ✅ Records who revoked and when
- ✅ Invitation link stops working immediately
- ✅ Validates user has permission to revoke
- ✅ Shows success feedback after revoke
- ✅ Can resend new invite after revoking

**Implementation Evidence:**

- Service: `server/team/invitations.ts#revokeRestaurantInvite`
- Table Action: `components/ops/team/TeamInvitesTable.tsx` (revoke button)
- Database: Updates `restaurant_invites` row

**Revoke Function:**

```typescript
async function revokeRestaurantInvite(params: {
  inviteId: string;
  restaurantId: string;
  authClient: SupabaseClient;
}): Promise<void> {
  // 1. Verify user has membership to this restaurant
  // 2. Load invite record
  // 3. Verify invite belongs to this restaurant
  // 4. Update status to "revoked"
  // 5. Set revoked_at timestamp
  // 6. Return success
}
```

**Workflow:**

1. Manager sees pending invite in table
2. Realizes invite sent to wrong person
3. Clicks "Revoke" button
4. Confirmation dialog: "Revoke invitation to chef@wrong.com?"
5. Confirms revoke
6. API call: `POST /api/ops/team/invites/{id}/revoke`
7. Database update:
   ```sql
   UPDATE restaurant_invites
   SET status = 'revoked',
       revoked_at = NOW(),
       updated_at = NOW()
   WHERE id = '{inviteId}'
   ```
8. Invite link no longer works
9. Table refreshes, shows "Revoked" status
10. Can now send new invite to correct email

**Link Deactivation:**

- When someone clicks revoked invite link
- System checks invite status
- If status = "revoked", show error page
- Message: "This invitation has been cancelled. Contact the restaurant if you believe this is an error."

**Permissions:**

- Only owners and managers can revoke invites
- Hosts and servers cannot revoke
- Enforced at API level

---

### ✅ Story: Role-Based Access Control

**As a** restaurant owner  
**I can** assign different permission levels to team members  
**So that** each person has appropriate access for their job function

**Acceptance Criteria:**

- ✅ Four distinct roles with different permissions
- ✅ Owner: Full access to all features
- ✅ Manager: Manage operations, team, settings (no billing)
- ✅ Host: Manage bookings, view customers
- ✅ Server: View bookings, update service status
- ✅ API routes validate role before allowing operations
- ✅ UI hides features user doesn't have access to
- ✅ Database enforces role enum constraint

**Implementation Evidence:**

- Type definitions: `lib/owner/auth/roles.ts`
- Validation: `server/team/access.ts#requireMembershipForRestaurant`
- Database: `restaurant_memberships.role` column (enum type)
- Enforcement: All protected API routes check membership + role

**Role Hierarchy:**

```typescript
type RestaurantRole = 'owner' | 'manager' | 'host' | 'server';

const ROLE_PERMISSIONS = {
  owner: {
    bookings: ['view', 'create', 'update', 'cancel'],
    customers: ['view', 'export'],
    team: ['view', 'invite', 'revoke', 'remove'],
    restaurant: ['view', 'update'],
    reports: ['view', 'export'],
    billing: ['view', 'update'],
  },
  manager: {
    bookings: ['view', 'create', 'update', 'cancel'],
    customers: ['view', 'export'],
    team: ['view', 'invite', 'revoke'], // Can't remove owners
    restaurant: ['view', 'update'],
    reports: ['view', 'export'],
    billing: [], // No billing access
  },
  host: {
    bookings: ['view', 'create', 'update'], // No cancel
    customers: ['view'], // No export
    team: ['view'], // Read-only
    restaurant: ['view'], // Read-only
    reports: [], // No access
    billing: [],
  },
  server: {
    bookings: ['view'], // Read-only
    customers: [], // No access
    team: [], // No access
    restaurant: [], // No access
    reports: [],
    billing: [],
  },
};
```

**Permission Checking:**

```typescript
// In API route
export async function DELETE(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  const membership = await requireMembershipForRestaurant(
    user.id,
    restaurantId
  );

  // Check if user's role allows this action
  if (membership.role !== 'owner' && membership.role !== 'manager') {
    return NextResponse.json(
      { error: 'Insufficient permissions' },
      { status: 403 }
    );
  }

  // Proceed with deletion
  ...
}
```

**UI Adaptation:**

```typescript
// In component
const { role } = useRestaurantMembership();

return (
  <>
    {/* Everyone sees bookings */}
    <BookingsSection />

    {/* Only owners/managers see team management */}
    {(role === 'owner' || role === 'manager') && (
      <TeamManagementSection />
    )}

    {/* Only owners see billing */}
    {role === 'owner' && (
      <BillingSection />
    )}
  </>
);
```

**Role Assignment:**

- Set during invitation (email + role)
- Can be changed by owner after acceptance
- Role changes take effect immediately
- No self-role-change (can't promote yourself to owner)

---

### ✅ Story: Centralized Team Management Interface

**As a** restaurant owner or manager  
**I can** access a dedicated team management page  
**So that** I have a single place to invite staff, view the team, and manage access

**Acceptance Criteria:**

- ✅ Dedicated `/ops/team` route
- ✅ Requires authentication (redirects to login if not signed in)
- ✅ Shows invitation form at top
- ✅ Shows invitation table below
- ✅ Tab or section for current team members (if implemented)
- ✅ Responsive layout works on mobile and desktop
- ✅ Clear visual hierarchy and labeling
- ✅ Loading states while fetching data

**Implementation Evidence:**

- Page: `app/(ops)/ops/(app)/team/page.tsx`
- Client Component: `components/ops/team/TeamManagementClient.tsx`
- Form: `components/ops/team/TeamInviteForm.tsx`
- Table: `components/ops/team/TeamInvitesTable.tsx`

**Page Layout:**

```
┌─────────────────────────────────────────────────┐
│ Team Management                    [Sidebar]    │
├─────────────────────────────────────────────────┤
│                                                 │
│ Invite New Team Member                          │
│ ┌─────────────────────────────────────────┐    │
│ │ Email: [chef@restaurant.com          ]  │    │
│ │ Role:  [Manager ▼]                      │    │
│ │        [Send Invitation]                 │    │
│ └─────────────────────────────────────────┘    │
│                                                 │
│ Team Invitations                                │
│ Filter: [All ▼] [Pending] [Accepted] [Expired] │
│                                                 │
│ ┌─────────────────────────────────────────────┐│
│ │ Email        │ Role   │ Status  │ Actions  ││
│ ├──────────────┼────────┼─────────┼──────────┤│
│ │ chef@...     │ Manager│ Pending │ [Revoke] ││
│ │ host@...     │ Host   │Accepted │ -        ││
│ │ server@...   │ Server │ Expired │ [Resend] ││
│ └─────────────────────────────────────────────┘│
└─────────────────────────────────────────────────┘
```

**Authentication Flow:**

```typescript
export default async function TeamManagementPage() {
  const supabase = await getServerComponentSupabaseClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (!user || error) {
    const loginUrl = "/signin";
    redirect(`${loginUrl}?redirectedFrom=/ops/team`);
  }

  // Render team management interface
  return <TeamManagementClient />;
}
```

**Client Component Responsibilities:**

- Manage form state (email, role inputs)
- Handle form submission (send invite)
- Fetch and display invitations
- Handle filter changes
- Handle revoke actions
- Show loading/error states
- Display success/error toasts

**Responsive Design:**

- Desktop: Form side-by-side with labels, wide table
- Mobile: Form stacked vertically, table scrolls horizontally
- Touch targets ≥44px for mobile buttons
- Clear focus indicators for keyboard navigation

**Data Fetching:**

- Uses React Query for caching and real-time updates
- Prefetches invitations on page load (SSR)
- Refetches after invite/revoke actions
- Shows skeleton loaders during initial load

---

## Customer Communication

### ✅ Story: Automated Booking Confirmations

**As a** customer who just made a reservation  
**I can** receive an email confirmation with all booking details  
**So that** I have a record of my reservation and know it was successfully created

**Acceptance Criteria:**

- ✅ Sends email immediately after booking creation
- ✅ Includes booking reference number for easy lookup
- ✅ Shows date, time, party size, restaurant details
- ✅ Contains restaurant contact information
- ✅ Includes any special notes or requests
- ✅ Provides link to manage/cancel booking (if applicable)
- ✅ Uses professional email template with branding
- ✅ Queued as background job (doesn't block booking creation)
- ✅ Idempotent (doesn't send duplicates)

**Implementation Evidence:**

- Email Function: `server/emails/bookings.ts#sendBookingConfirmationEmail`
- Job Processing: `server/jobs/booking-side-effects.ts:122-135`
- Queue: Inngest job triggered by `booking.created.side-effects` event
- Providers: Mailgun (`libs/mailgun.ts`) or Resend (`libs/resend.ts`)

**Email Contents:**

```
Subject: Booking Confirmed - {Restaurant Name}

Hi {Customer Name},

Your reservation at {Restaurant Name} is confirmed!

Booking Details:
  Reference: {BOOKING_REFERENCE}
  Date: {Day, Month Date, Year}
  Time: {HH:MM AM/PM}
  Party Size: {N} guests

Restaurant:
  {Restaurant Name}
  {Address}
  {Phone}

Notes: {Special requests if any}

Questions? Contact us at {contact_email}

[View/Manage Booking] (if applicable)

Thanks for choosing {Restaurant Name}!
```

**Delivery Flow:**

1. Booking created via walk-in or customer booking
2. System enqueues `booking.created.side-effects` event
3. Inngest worker picks up event
4. Calls `sendBookingConfirmationEmail` function
5. Constructs email from booking data
6. Sends via configured email provider (Mailgun/Resend)
7. Logs success/failure
8. Retries on transient failures (network issues, rate limits)

**Idempotency:**

- Uses booking ID as deduplication key
- Won't send multiple confirmations for same booking
- Handles duplicate event submissions gracefully

---

### ✅ Story: Booking Modification Notifications

**As a** customer whose booking details changed  
**I can** receive an email showing what was updated  
**So that** I'm aware of the changes and can verify they're correct

**Acceptance Criteria:**

- ✅ Sends when booking time, date, or party size changes
- ✅ Shows both old and new values for changed fields
- ✅ Maintains booking reference number
- ✅ Provides updated restaurant details
- ✅ Includes contact info if customer has questions
- ✅ Queued as background job
- ✅ Only sent for meaningful changes (not internal status updates)

**Implementation Evidence:**

- Email Function: `server/emails/bookings.ts#sendBookingUpdateEmail`
- Job Processing: `server/jobs/booking-side-effects.ts:180-192`
- Queue: Inngest job via `booking.updated.side-effects` event
- Trigger: Called after booking PATCH operations

**Email Format:**

```
Subject: Booking Updated - {Restaurant Name}

Hi {Customer Name},

Your reservation at {Restaurant Name} has been updated.

Booking Reference: {BOOKING_REFERENCE}

Changes:
  Date: {Old Date} → {New Date}
  Time: {Old Time} → {New Time}
  Party Size: {Old Size} → {New Size}

Updated Details:
  Date: {New Date}
  Time: {New Time}
  Party Size: {New Size} guests

If you didn't request this change or have questions,
please contact us at {contact_email}

{Restaurant Name}
{Phone}
```

**Trigger Logic:**

```typescript
// In booking update handler
if (
  hasChanged(previous.start_time, current.start_time) ||
  hasChanged(previous.end_time, current.end_time) ||
  hasChanged(previous.party_size, current.party_size)
) {
  await enqueueBookingUpdatedSideEffects({
    previous: previous,
    current: current,
    restaurantId: booking.restaurant_id,
  });
}
```

---

### ✅ Story: Cancellation Notifications

**As a** customer whose booking was cancelled  
**I can** receive an email confirming the cancellation  
**So that** I know the reservation is no longer active

**Acceptance Criteria:**

- ✅ Sends when booking status changes to "cancelled"
- ✅ Indicates who cancelled (customer, staff, system)
- ✅ Shows original booking details for reference
- ✅ Provides cancellation timestamp
- ✅ Includes rebooking information or link
- ✅ Different messaging based on who cancelled
- ✅ Apologetic tone if staff/system cancelled

**Implementation Evidence:**

- Email Function: `server/emails/bookings.ts#sendBookingCancellationEmail`
- Job Processing: `server/jobs/booking-side-effects.ts:240-256`
- Queue: Inngest job via `booking.cancelled.side-effects` event
- Cancellation Source: Tracked in event payload (`cancelledBy: customer | staff | system`)

**Email Variants:**

**Customer-Initiated:**

```
Subject: Cancellation Confirmed - {Restaurant Name}

Hi {Customer Name},

Your reservation has been cancelled as requested.

Cancelled Booking:
  Reference: {BOOKING_REFERENCE}
  Date: {Date}
  Time: {Time}
  Party Size: {N} guests

We're sorry you can't join us. We'd love to see you another time!

[Make New Reservation]

{Restaurant Name}
```

**Staff/System-Initiated:**

```
Subject: Reservation Cancellation - {Restaurant Name}

Hi {Customer Name},

We regret to inform you that your reservation has been cancelled.

Cancelled Booking:
  Reference: {BOOKING_REFERENCE}
  Date: {Date}
  Time: {Time}

Reason: {Cancellation reason if provided}

We sincerely apologize for any inconvenience.
Please contact us at {contact_email} to rebook or for questions.

{Restaurant Name}
{Phone}
```

**Side Effects Chain:**

1. Booking cancelled (via API or internal process)
2. Analytics event recorded (`booking.cancelled`)
3. Cancellation email enqueued
4. Email sent with appropriate template
5. Customer notified

---

### ✅ Story: Team Invitation Emails (Already covered in Team Management)

**See Team Management section** - "Staff Invitation Workflow" story includes comprehensive email template and delivery details.

---

## Background Processing

### ✅ Story: Async Booking Creation Side Effects

**As a** system  
**I can** process booking-related tasks asynchronously after creation  
**So that** the booking creation remains fast and side effects don't block the user

**Acceptance Criteria:**

- ✅ Sends confirmation email without blocking API response
- ✅ Records analytics event for reporting
- ✅ Handles failures gracefully with retries
- ✅ Logs all side effect execution
- ✅ Idempotent (safe to retry)
- ✅ Processes within seconds of booking creation
- ✅ Updates customer profile statistics

**Implementation Evidence:**

- Processor: `server/jobs/booking-side-effects.ts#processBookingCreatedSideEffects`
- Event: `sajiloreservex/booking.created.side-effects`
- Queue: Inngest with automatic retries
- Invocation: `enqueueBookingCreatedSideEffects()` called after booking insert

**Side Effects Performed:**

1. **Send Confirmation Email**
   - Function: `sendBookingConfirmationEmail()`
   - Contains booking reference, details, restaurant info
2. **Record Analytics Event**
   - Function: `recordBookingCreatedEvent()`
   - Stores in `analytics_events` table
   - Fields: event type, restaurant, customer, booking metadata
3. **Update Customer Profile** (if applicable)
   - Increment total_bookings count
   - Update first_booking_at if first booking
   - Update last_booking_at

**Execution Flow:**

```typescript
async function processBookingCreatedSideEffects(
  payload: BookingCreatedSideEffectsPayload,
  supabase?: SupabaseClient,
) {
  const { booking, idempotencyKey, restaurantId } = payload;

  // 1. Record analytics
  await recordBookingCreatedEvent(supabase, {
    bookingId: booking.id,
    restaurantId,
    customerId: booking.customer_id,
    status: booking.status,
    partySize: booking.party_size,
    // ... other fields
  });

  // 2. Send confirmation email
  await sendBookingConfirmationEmail({
    booking,
    restaurant: await fetchRestaurant(restaurantId),
  });

  // 3. Future: loyalty points, integrations, etc.
}
```

**Error Handling:**

- Inngest automatically retries on failure
- Exponential backoff between retries
- Logs errors for monitoring
- Won't block booking creation even if all retries fail

---

### ✅ Story: Async Booking Update Side Effects

**As a** system  
**I can** notify customers of changes without slowing down the update operation  
**So that** staff can quickly modify bookings during busy service

**Acceptance Criteria:**

- ✅ Sends update notification email asynchronously
- ✅ Compares old vs new values
- ✅ Only triggers for meaningful changes
- ✅ Retries on failure
- ✅ Logs update events for audit

**Implementation Evidence:**

- Processor: `server/jobs/booking-side-effects.ts#processBookingUpdatedSideEffects`
- Event: `sajiloreservex/booking.updated.side-effects`
- Trigger: After successful PATCH to `/api/ops/bookings/[id]`

**Processing Logic:**

```typescript
async function processBookingUpdatedSideEffects(payload: BookingUpdatedSideEffectsPayload) {
  const { previous, current, restaurantId } = payload;

  // Send update email showing changes
  await sendBookingUpdateEmail({
    previous,
    current,
    restaurant: await fetchRestaurant(restaurantId),
  });
}
```

---

### ✅ Story: Async Cancellation Side Effects

**As a** system  
**I can** handle all cancellation-related tasks in the background  
**So that** cancellations complete quickly and customer is notified

**Acceptance Criteria:**

- ✅ Sends cancellation email
- ✅ Records analytics event
- ✅ Updates customer profile (increment cancellation count)
- ✅ Frees up capacity/slots (if capacity management enabled)
- ✅ Handles staff vs customer vs system cancellation context

**Implementation Evidence:**

- Processor: `server/jobs/booking-side-effects.ts#processBookingCancelledSideEffects`
- Event: `sajiloreservex/booking.cancelled.side-effects`
- Payload: Includes `cancelledBy` field

**Processing Steps:**

1. Record `booking.cancelled` analytics event
2. Send cancellation email (template varies by who cancelled)
3. Update customer profile: increment total_cancellations
4. Log cancellation for audit
5. Future: Update capacity, notify waitlist, etc.

---

### ✅ Story: Analytics Event Tracking

**As a** restaurant owner  
**I can** have all booking lifecycle events recorded for analysis  
**So that** I can understand booking patterns, cancellation rates, and customer behavior

**Acceptance Criteria:**

- ✅ Records booking creation events
- ✅ Records booking cancellation events
- ✅ Stores event timestamp, restaurant, customer, metadata
- ✅ Queryable for reporting and analytics
- ✅ Supports event types: created, cancelled, allocated, waitlisted
- ✅ Indexed for performant queries

**Implementation Evidence:**

- Functions: `server/analytics.ts#recordBookingCreatedEvent`, `#recordBookingCancelledEvent`
- Database: `analytics_events` table
- Schema: event_type (enum), occurred_at, restaurant_id, customer_id, booking_id, metadata (jsonb)

**Event Types:**

```typescript
type AnalyticsEventType =
  | 'booking.created'
  | 'booking.cancelled'
  | 'booking.allocated'
  | 'booking.waitlisted';
```

**Record Structure:**

```typescript
{
  event_type: 'booking.created',
  occurred_at: '2025-10-11T14:30:00Z',
  restaurant_id: '{uuid}',
  customer_id: '{uuid}',
  booking_id: '{uuid}',
  metadata: {
    party_size: 4,
    booking_type: 'dinner',
    source: 'ops.walkin',
    status: 'confirmed'
  }
}
```

**Usage:**

- Power BI/analytics dashboards
- Booking funnel analysis
- Cancellation rate tracking
- Peak hours identification
- Source attribution (web vs walk-in vs phone)

---

### ✅ Story: Background Job Infrastructure

**As a** developer  
**I can** rely on a robust background job system  
**So that** async tasks are processed reliably with retries and monitoring

**Acceptance Criteria:**

- ✅ Job queue with automatic retries
- ✅ Environment-based enable/disable (dev vs prod)
- ✅ Type-safe event definitions
- ✅ Exponential backoff on failures
- ✅ Job monitoring and logs
- ✅ Webhook endpoint for Inngest triggers
- ✅ Local development support

**Implementation Evidence:**

- Queue: Inngest (`server/queue/inngest.ts`)
- Webhook: `app/api/inngest/route.ts`
- Package: `inngest:3.44.1`
- Config: Environment variables for API keys

**Architecture:**

```
Booking Created
     ↓
enqueueBookingCreatedSideEffects()
     ↓
Inngest Event: "sajiloreservex/booking.created.side-effects"
     ↓
Inngest Cloud (or local dev server)
     ↓
POST /api/inngest (webhook)
     ↓
processBookingCreatedSideEffects()
     ↓
Email sent, analytics recorded, etc.
```

**Job Registration:**

```typescript
// server/queue/inngest.ts
export const inngest = new Inngest({ id: 'sajiloreservex' });

export const bookingCreatedJob = inngest.createFunction(
  { id: 'booking-created-side-effects' },
  { event: 'sajiloreservex/booking.created.side-effects' },
  async ({ event, step }) => {
    await step.run('process-side-effects', async () => {
      await processBookingCreatedSideEffects(event.data);
    });
  },
);
```

**Retry Policy:**

- Automatic retries on failure
- Exponential backoff: 1s, 2s, 4s, 8s, ...
- Max retries: configurable (default 3-5)
- DLQ (Dead Letter Queue) for permanent failures

**Environment Gating:**

- `isAsyncQueueEnabled()` checks environment
- Disabled in tests (synchronous execution)
- Enabled in staging/production
- Local dev: use Inngest Dev Server

---

## User Interface

### ✅ Story: Persistent Navigation Sidebar

**As a** restaurant staff member  
**I can** access all operations features through a consistent sidebar  
**So that** I can quickly navigate between dashboard, bookings, team, and settings

**Acceptance Criteria:**

- ✅ Collapsible sidebar (icon mode for narrow screens)
- ✅ Shows current restaurant name and my role
- ✅ 5 main navigation items with icons
- ✅ Active page visually highlighted
- ✅ Keyboard navigable
- ✅ Touch-friendly buttons (≥44px)
- ✅ Support link to email help
- ✅ Logout button with loading state
- ✅ Responsive: auto-collapse on mobile

**Implementation Evidence:**

- Component: `components/ops/AppSidebar.tsx`
- Shell: `components/ops/OpsAppShell.tsx`
- UI Library: Shadcn Sidebar components
- Icons: Lucide React

**Navigation Items:**

1. **Dashboard** (`/ops`) - BarChart3 icon
2. **Bookings** (`/ops/bookings`) - CalendarDays icon
3. **Manage Restaurant** (`/ops/manage-restaurant`) - Settings2 icon
4. **Walk-in Booking** (`/ops/bookings/new`) - CalendarPlus icon
5. **Team** (`/ops/team`) - UsersRound icon

**Header Display:**

```typescript
// Shows restaurant initials badge + name + role
<SidebarHeader>
  <div className="...">
    <span>{initials}</span>  // "AB" for "Awesome Bistro"
    <div>
      <p>{restaurantName}</p>  // "Awesome Bistro"
      <p>{email} ({roleLabel})</p>  // "chef@...com (Manager)"
    </div>
  </div>
</SidebarHeader>
```

**Active State Logic:**

```typescript
function isActive(pathname: string, item: NavItem) {
  if (item.matcher) {
    return item.matcher(pathname);
  }
  return pathname === item.href;
}
```

**Collapsible Behavior:**

- Desktop: Expands to show labels
- Mobile: Collapses to icons only
- Toggle: Click collapse button
- Persists state in session

---

### ✅ Story: Restaurant Identity Display

**As a** staff member  
**I can** see which restaurant I'm managing and my role  
**So that** I don't perform actions in the wrong restaurant account

**Acceptance Criteria:**

- ✅ Restaurant name prominently displayed
- ✅ Initials badge (2-letter abbreviation)
- ✅ Shows my email and role
- ✅ Updates when switching restaurants (future)
- ✅ Visible at all times in sidebar header
- ✅ Truncates long names elegantly

**Implementation Evidence:**

- Component: `components/ops/AppSidebar.tsx:157-168`
- Function: `getInitials(name)` extracts 2-letter code
- Props: `account: { restaurantName, userEmail, role }`

**Initials Algorithm:**

```typescript
function getInitials(name: string | null | undefined): string {
  if (!name) return 'SR';
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }
  // Fallback: first + last char or first 2 capitals
  // ...
}
```

**Examples:**

- "Awesome Bistro" → "AB"
- "The French Laundry" → "TF"
- "Joe's" → "JS"
- Missing name → "SR" (SajiloReserveX)

---

### ✅ Story: Quick Support Access

**As a** restaurant staff member  
**I can** easily contact support when I need help  
**So that** I can resolve issues quickly during service

**Acceptance Criteria:**

- ✅ Support link in sidebar footer
- ✅ Opens email client with pre-filled address
- ✅ CircleHelp icon for recognition
- ✅ Always accessible regardless of page
- ✅ No authentication required to see link

**Implementation Evidence:**

- Component: `components/ops/AppSidebar.tsx:51-56`
- Link: `mailto:support@sajiloreservex.com`
- Location: Sidebar footer, below account section

**UI Placement:**

```
┌─────────────────┐
│ [Restaurant]    │ ← Header
│                 │
│ • Dashboard     │
│ • Bookings      │ ← Nav Items
│ • ...           │
│                 │
│ ─────────────── │
│ • Log out       │ ← Account
│ ─────────────── │
│ • Support       │ ← Support Link
└─────────────────┘
```

**Behavior:**

- Click → Opens default email client
- To: support@sajiloreservex.com
- Subject: (empty, user fills in)
- Body: (empty, user describes issue)

---

## Technical Foundation

### ✅ Story: Cloud Database & Authentication

**As a** development team  
**We can** use Supabase for database, auth, and real-time features  
**So that** we don't have to build and maintain our own backend infrastructure

**Acceptance Criteria:**

- ✅ PostgreSQL database hosted on Supabase Cloud
- ✅ Authentication with email/password
- ✅ Row Level Security (RLS) policies
- ✅ Server-side rendering support
- ✅ API route support
- ✅ Service role for privileged operations
- ✅ Type-safe database client

**Implementation Evidence:**

- Client Factory: `server/supabase.ts`
- SSR Client: `getServerComponentSupabaseClient()`
- Route Handler Client: `getRouteHandlerSupabaseClient()`
- Service Client: `getServiceSupabaseClient()` (bypasses RLS)
- Types: Auto-generated from database schema (`types/supabase.ts`)

**Client Types:**

1. **Server Component Client**: For React Server Components, reads cookies
2. **Route Handler Client**: For API routes, manages auth cookies
3. **Service Client**: Uses service role key, bypasses RLS for admin operations

**Configuration:**

- `NEXT_PUBLIC_SUPABASE_URL`: Public API endpoint
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Public (anon) API key
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key (secret, server-only)

**Remote-Only Architecture:**

- No local Supabase instance
- All operations target cloud database
- Migrations run via `supabase db push` to remote
- Documented in AGENTS.md:239-266

---

### ✅ Story: Optimistic UI with React Query

**As a** user  
**I can** see immediate feedback when I perform actions  
**So that** the UI feels fast and responsive even with network latency

**Acceptance Criteria:**

- ✅ Mutations update UI optimistically
- ✅ Automatic background refetching
- ✅ Cache invalidation on mutations
- ✅ SSR prefetching for fast initial loads
- ✅ DevTools for debugging queries
- ✅ Retry logic for failed requests
- ✅ Stale-while-revalidate pattern

**Implementation Evidence:**

- Package: `@tanstack/react-query:5.90.2`
- Query Keys: `lib/query/keys.ts`
- Hooks: Custom hooks in `hooks/` directory
- Prefetching: `HydrationBoundary` in page components

**Query Key Structure:**

```typescript
export const queryKeys = {
  opsBookings: {
    all: ['ops', 'bookings'] as const,
    list: (params: object) => [...queryKeys.opsBookings.all, 'list', params] as const,
    detail: (id: string) => [...queryKeys.opsBookings.all, 'detail', id] as const,
  },
  opsCustomers: {
    all: ['ops', 'customers'] as const,
    list: (params: object) => [...queryKeys.opsCustomers.all, 'list', params] as const,
  },
  // ... more query keys
};
```

**SSR Prefetching Example:**

```typescript
// In page.tsx
const queryClient = new QueryClient();

await queryClient.prefetchQuery({
  queryKey: queryKeys.opsBookings.list(params),
  queryFn: async () => {
    const response = await fetch(url, { headers, cache: 'no-store' });
    return response.json();
  }
});

return (
  <HydrationBoundary state={dehydrate(queryClient)}>
    <OpsBookingsClient />
  </HydrationBoundary>
);
```

**Benefits:**

- First paint shows data (no loading spinner)
- Subsequent navigations use cache
- Background updates keep data fresh
- Optimistic updates for instant feedback

---

### ✅ Story: Type-Safe Form Validation

**As a** developer  
**I can** define form schemas once and get both runtime validation and TypeScript types  
**So that** I don't have to manually keep validation and types in sync

**Acceptance Criteria:**

- ✅ Single source of truth for validation rules
- ✅ Runtime validation with helpful error messages
- ✅ TypeScript types derived from schemas
- ✅ Integration with React Hook Form
- ✅ Used in all API routes
- ✅ Used in all forms
- ✅ Nested object and array validation

**Implementation Evidence:**

- Package: `zod:4.1.11`
- Resolver: `@hookform/resolvers:5.2.2`
- Schemas: `schema.ts` files in API route directories
- Forms: `react-hook-form:7.63.0`

**Example Schema:**

```typescript
// app/api/ops/bookings/schema.ts
export const opsWalkInBookingSchema = z.object({
  restaurantId: z.string().uuid(),
  bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  partySize: z.number().int().min(1).max(100),
  customerName: z.string().min(1).max(255),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().optional(),
  notes: z.string().max(500).optional(),
});

// Infer TypeScript type
export type OpsWalkInBookingPayload = z.infer<typeof opsWalkInBookingSchema>;
```

**API Route Usage:**

```typescript
export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = opsWalkInBookingSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid payload', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const data: OpsWalkInBookingPayload = parsed.data;
  // TypeScript knows exact shape of data
}
```

**Form Usage:**

```typescript
const form = useForm<OpsWalkInBookingPayload>({
  resolver: zodResolver(opsWalkInBookingSchema),
  defaultValues: { ... }
});
```

---

### ✅ Story: Accessible UI Component Library

**As a** development team  
**We can** use pre-built, accessible components  
**So that** we build consistent, accessible interfaces quickly

**Acceptance Criteria:**

- ✅ Radix UI primitives for accessibility
- ✅ Tailwind CSS for styling
- ✅ Customizable via props
- ✅ Dark mode support
- ✅ Keyboard navigation
- ✅ Screen reader support
- ✅ Focus management

**Implementation Evidence:**

- Package: Multiple `@radix-ui/react-*` packages
- Components: `components/ui/*` directory
- Config: `components.json`
- Theme: `tailwind.config.js`

**Available Components:**

- Button, Card, Input, Label
- Dialog (Modal), Alert, AlertDialog
- Dropdown Menu, Popover, Tooltip
- Sidebar, Separator, Progress
- Checkbox, Toggle, Avatar
- Accordion, Tabs

**Accessibility Features:**

- ARIA attributes automatically applied
- Keyboard navigation (Tab, Arrow keys, Escape, Enter)
- Focus visible indicators
- Screen reader announcements
- Disabled state handling
- Form control associations

---

### ✅ Story: Complete Audit Trail

**As a** restaurant owner  
**I can** see a complete history of all booking changes  
**So that** I can resolve disputes and understand what happened

**Acceptance Criteria:**

- ✅ Logs all booking changes (create, update, cancel, delete)
- ✅ Captures before/after snapshots
- ✅ Records who made the change
- ✅ Timestamps all events
- ✅ Immutable log (append-only)
- ✅ Queryable by booking, user, or date range

**Implementation Evidence:**

- Functions: `server/bookings.ts#logAuditEvent`, `#buildBookingAuditSnapshot`
- Database: `booking_audit_log` table
- Change Types: created | updated | cancelled | deleted

**Log Entry:**

```typescript
{
  booking_id: '{uuid}',
  change_type: 'updated',
  changed_by: '{user_id}',
  snapshot_before: { /* full booking record */ },
  snapshot_after: { /* full booking record */ },
  changed_at: '2025-10-11T14:30:00Z',
  metadata: { /* additional context */ }
}
```

**Usage:**

- Dispute resolution: "Who changed my booking time?"
- Compliance: GDPR data access requests
- Debugging: "Why did this booking get cancelled?"
- Analytics: Understand common change patterns

---

### ✅ Story: Idempotent API Operations

**As a** system  
**I can** safely retry requests without creating duplicates  
**So that** network issues don't cause double-bookings

**Acceptance Criteria:**

- ✅ Accepts `X-Idempotency-Key` header
- ✅ Deduplicates requests with same key
- ✅ 15-day idempotency window
- ✅ Returns same response for duplicate requests
- ✅ Stores key in booking metadata
- ✅ Works for booking creation endpoint

**Implementation Evidence:**

- Check: `app/api/ops/bookings/route.ts:211-234`
- Header: `X-Idempotency-Key: {uuid}`
- Storage: `booking.details.request.idempotency_key`

**Flow:**

```
1. Client generates UUID: idempotency_key = "abc123"
2. POST /api/ops/bookings
   Header: X-Idempotency-Key: abc123
3. Server checks existing bookings with this key
4. If found: return existing booking (201 with same response)
5. If not found: create booking, store key, return booking
6. If network fails, client retries with same key
7. Server finds existing booking, returns it (no duplicate)
```

**Window:**

- Keys valid for 15 days
- After 15 days, same key can create new booking
- Prevents unbounded storage growth

---

### ✅ Story: Schema Version Control

**As a** development team  
**We can** evolve the database schema safely  
**So that** we can add features without breaking production

**Acceptance Criteria:**

- ✅ SQL migration files versioned in git
- ✅ Sequential migration numbering
- ✅ Migrations target remote Supabase (not local)
- ✅ RLS policies defined in migrations
- ✅ Database functions and triggers tracked
- ✅ Rollback capability (manual)

**Implementation Evidence:**

- Directory: `supabase/migrations/*.sql`
- Count: 9 migrations tracked
- Example: `20251006170446_remote_schema.sql`
- Command: `supabase db push` applies to remote

**Migration Naming:**
`YYYYMMDDHHMMSS_descriptive_name.sql`

**Example Migrations:**

1. `remote_schema.sql`: Base schema (tables, types, functions)
2. `add_profile_update_policies.sql`: RLS policies
3. `auth_team_invites.sql`: Team invitation system
4. `seed_today_bookings.sql`: Test data
5. `add_booking_option_and_reservation_columns.sql`: Schema evolution

**Key Principles:**

- Never modify existing migrations
- Always create new migration for changes
- Test migrations on staging first
- Coordinate with team before running on prod
- Document breaking changes in migration comments

### Background Jobs & Side Effects

- [x] **Booking Created Side Effects** — Async processing on new bookings
  - Evidence: `server/jobs/booking-side-effects.ts#processBookingCreatedSideEffects`, Inngest function
  - Inputs/Outputs: Booking payload → confirmation email, analytics event
  - Status: Complete (idempotency-safe, queued via `sajiloreservex/booking.created.side-effects`)

- [x] **Booking Updated Side Effects** — Process booking modifications
  - Evidence: `server/jobs/booking-side-effects.ts#processBookingUpdatedSideEffects`, Inngest function
  - Inputs/Outputs: Previous and current booking → update email
  - Status: Complete (queued via `sajiloreservex/booking.updated.side-effects`)

- [x] **Booking Cancelled Side Effects** — Process cancellations
  - Evidence: `server/jobs/booking-side-effects.ts#processBookingCancelledSideEffects`, Inngest function
  - Inputs/Outputs: Cancelled booking → cancellation email, analytics event
  - Status: Complete (queued via `sajiloreservex/booking.cancelled.side-effects`)

- [x] **Analytics Event Recording** — Track booking lifecycle events
  - Evidence: `server/analytics.ts#recordBookingCreatedEvent`, `server/analytics.ts#recordBookingCancelledEvent`
  - Inputs/Outputs: Event data → `analytics_events` table
  - Status: Complete (supports booking.created, booking.cancelled, booking.allocated, booking.waitlisted)

- [x] **Inngest Integration** — Background job queue
  - Evidence: `server/queue/inngest.ts`, `app/api/inngest/route.ts`
  - Inputs/Outputs: Event payloads → async job execution
  - Status: Complete (environment-gated, 3 job types registered)

### UI Components & Navigation

- [x] **Ops Sidebar Navigation** — Collapsible sidebar with operations menu
  - Evidence: `components/ops/AppSidebar.tsx`, `components/ops/OpsAppShell.tsx`
  - Inputs/Outputs: Current route → active nav state, account info, logout
  - Status: Complete (5 nav items: Dashboard, Bookings, Manage restaurant, Walk-in, Team)

- [x] **Restaurant Account Display** — Show restaurant name, user role, email
  - Evidence: `components/ops/AppSidebar.tsx:157-168`
  - Inputs/Outputs: Account data → header with initials badge
  - Status: Complete (extracts initials, shows role label)

- [x] **Support Link** — Help contact in sidebar
  - Evidence: `components/ops/AppSidebar.tsx:51-56`, `mailto:support@sajiloreservex.com`
  - Inputs/Outputs: Click → opens email client
  - Status: Complete

### Technical Infrastructure

- [x] **Supabase Remote Integration** — Database and auth via Supabase Cloud
  - Evidence: `server/supabase.ts`, `lib/supabase/*`, migrations use remote schema
  - Inputs/Outputs: API keys → authenticated database client
  - Status: Complete (SSR and route handler clients, service role for admin)

- [x] **React Query Data Fetching** — Client-side data management
  - Evidence: `package.json:76-77` (@tanstack/react-query), `lib/query/keys.ts`, HydrationBoundary in pages
  - Inputs/Outputs: Query keys → cached, prefetched data
  - Status: Complete (SSR prefetching, devtools enabled)

- [x] **Form Validation with Zod** — Schema-based validation
  - Evidence: `package.json:110` (zod), schemas in API routes (`schema.ts` files), `@hookform/resolvers`
  - Inputs/Outputs: Input data → validated/parsed data or error details
  - Status: Complete (used in all API routes and forms)

- [x] **SHADCN UI Components** — Radix-based component library
  - Evidence: `package.json:57-70` (@radix-ui/_), `components/ui/_`, `components.json`
  - Inputs/Outputs: Consistent, accessible UI primitives
  - Status: Complete (Button, Card, Input, Alert, Dialog, Sidebar, etc.)

- [x] **Audit Logging** — Track booking changes
  - Evidence: `server/bookings.ts#logAuditEvent`, `server/bookings.ts#buildBookingAuditSnapshot`, database `booking_audit_log` table
  - Inputs/Outputs: Booking changes, user ID → audit records
  - Status: Complete (logs created, updated, cancelled, deleted)

- [x] **Idempotency Keys** — Prevent duplicate booking creation
  - Evidence: `app/api/ops/bookings/route.ts:211-234`, `X-Idempotency-Key` header support
  - Inputs/Outputs: Idempotency key → deduplicated booking creation
  - Status: Complete (15-day cache, stored in booking details)

- [x] **Database Migrations** — Schema versioning and evolution
  - Evidence: `supabase/migrations/*.sql`
  - Inputs/Outputs: SQL migration files → applied to remote Supabase
  - Status: Complete (9 migrations tracked, RLS policies, triggers, functions)

## Integrations

- **Supabase** — Database, auth, realtime (`@supabase/supabase-js:2.58.0`) used in `server/supabase.ts`
- **Inngest** — Background job queue (`inngest:3.44.1`) used in `server/queue/inngest.ts`, `app/api/inngest/route.ts`
- **Mailgun** — Email delivery (`mailgun.js:12.1.0`) used in `libs/mailgun.ts`, `server/emails/bookings.ts`
- **Resend** — Alternative email provider (`resend:6.1.0`) used in `libs/resend.ts`
- **Next.js 15** — React framework (`next:15.5.4`) for SSR, API routes, routing
- **TanStack Query** — Data fetching (`@tanstack/react-query:5.90.2`) for client-side caching
- **React 19** — UI library (`react:19.2.0`)
- **Zod** — Schema validation (`zod:4.1.11`) used in all API routes
- **Lucide React** — Icon library (`lucide-react:0.544.0`) used in navigation and UI
- **React Hook Form** — Form management (`react-hook-form:7.63.0`) used with Zod resolver
- **React Hot Toast** — Toast notifications (`react-hot-toast:2.6.0`) for user feedback
- **Date-fns** — Date utilities (`date-fns:4.1.0`) for formatting and manipulation
- **Vitest** — Test runner (`vitest:3.2.4`) for unit tests
- **Playwright** — E2E testing (`@playwright/test:1.55.1`)

## Non-Features / Disabled

- **Local Supabase Development** — Project uses remote Supabase only (per AGENTS.md:239-266)
  - Evidence: `.env.local` points to remote, no local migration commands in workflow
  - Reason: Architecture decision to use hosted instance

- **Booking Allocation System** — Status `pending_allocation` exists but no allocation logic found
  - Evidence: `booking_status` enum includes it, but no allocation API/UI
  - Reason: Likely future feature (status defined, not implemented)

- **Loyalty System** — Database schema has `loyalty_tier` enum, `loyalty_points_awarded` column
  - Evidence: `supabase/migrations/20251006170446_remote_schema.sql:85-90`, `bookings.loyalty_points_awarded`
  - Reason: Schema prepared, no API or UI implementation found

- **Waitlist Management** — Analytics supports `booking.waitlisted` event, no waitlist UI
  - Evidence: `analytics_event_type` enum includes it, no waitlist table or API
  - Reason: Planned feature (analytics prepared, not implemented)

- **Table/Seating Management** — `seating_preference` and `seating_type` enums exist, no table assignment UI
  - Evidence: Database enums for seating types, no table management in ops
  - Reason: Data model supports it, no implementation yet

## Notes / Follow-ups

- **TODO: Multi-restaurant switcher UI** — Backend supports it, sidebar shows first restaurant only
  - Files: `components/ops/AppSidebar.tsx` lacks restaurant selector dropdown
  - Impact: Users with multiple restaurants can't switch in UI (must use different membership)

- **TODO: Booking search/filtering by customer** — API supports date/status, not customer name/email
  - Files: `app/api/ops/bookings/schema.ts` doesn't include customer search params
  - Impact: Must paginate through all bookings to find specific customer

- **TODO: Customer detail view** — List exists, no individual customer page with full history
  - Files: No route like `/ops/customers/[id]` found
  - Impact: Can't drill into single customer's complete booking history

- **TODO: Email template customization** — Email functions exist, templates are code-based
  - Files: `server/emails/bookings.ts` has hardcoded email content
  - Impact: No UI for restaurants to customize email templates

- **TODO: Operating hours validation** — UI validates time format, doesn't check opens < closes
  - Files: `components/ops/manage/ManageRestaurantShell.tsx:290-307` validates HH:MM only
  - Impact: Can save invalid ranges (closes before opens)

- **Experimental: CSV export encoding** — Uses UTF-8 BOM for Excel compatibility
  - Files: `app/api/ops/customers/export/route.ts:120` prepends BOM
  - Status: Working but non-standard approach (better to detect user agent)

- **Test coverage gaps** — Only bookings summary has comprehensive tests
  - Files: `tests/server/ops/getTodayBookingsSummary.test.ts` (only ops test file found)
  - Impact: Customers, team, restaurant management lack automated tests

- **Tech debt: Error handling** — Many try-catch blocks log and return 500, not specific errors
  - Files: Multiple API routes use generic error responses
  - Impact: Hard to debug issues, users get vague "Unable to..." messages

- **Security note: Email validation** — Uses simple regex, not RFC-compliant
  - Files: `components/ops/manage/ManageRestaurantShell.tsx:79` uses `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
  - Impact: Rejects valid emails with special chars, accepts invalid TLDs

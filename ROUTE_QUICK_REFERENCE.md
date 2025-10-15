# SajiloReserveX - Route Quick Reference

**For detailed analysis, see**: [COMPREHENSIVE_ROUTE_ANALYSIS.md](./COMPREHENSIVE_ROUTE_ANALYSIS.md)

## Quick Stats

- **Total Routes**: 77
- **Page Routes**: 28
- **API Routes**: 49
- **Framework**: Next.js 15.5.4 (App Router)
- **Database**: Supabase PostgreSQL
- **Authentication**: Supabase Auth (Magic Links)

---

## Public Pages (No Auth)

| Route                                 | Purpose                     |
| ------------------------------------- | --------------------------- |
| `/`                                   | Landing page                |
| `/browse`                             | Restaurant directory        |
| `/pricing`                            | Plans & features            |
| `/create`                             | Booking CTA page            |
| `/checkout`                           | Payment/checkout            |
| `/signin`                             | Authentication              |
| `/reserve`                            | Reservation landing         |
| `/reserve/[id]`                       | Booking confirmation        |
| `/reserve/r/[slug]`                   | Restaurant-specific booking |
| `/item/[slug]`                        | Direct restaurant entry     |
| `/blog`                               | Blog listing                |
| `/blog/[articleId]`                   | Blog post                   |
| `/tos`, `/privacy-policy`, `/terms/*` | Legal pages                 |

## Protected Pages (Auth Required)

| Route                      | Auth Level       | Purpose                   |
| -------------------------- | ---------------- | ------------------------- |
| `/my-bookings`             | User             | Booking history           |
| `/profile/manage`          | User             | User profile              |
| `/thank-you`               | Token (one-time) | Post-booking confirmation |
| `/ops`                     | Staff            | Ops dashboard             |
| `/ops/bookings`            | Staff            | Booking management        |
| `/ops/bookings/new`        | Staff            | Walk-in booking           |
| `/ops/customer-details`    | Staff            | Customer view             |
| `/ops/team`                | Staff            | Team management           |
| `/ops/restaurant-settings` | Staff            | Restaurant config         |

---

## Core API Endpoints

### Bookings

| Method | Endpoint                     | Auth               | Purpose                       |
| ------ | ---------------------------- | ------------------ | ----------------------------- |
| POST   | `/api/bookings`              | None               | Create booking (rate limited) |
| GET    | `/api/bookings?email&phone`  | None               | Guest lookup                  |
| GET    | `/api/bookings?me=1`         | User               | My bookings (paginated)       |
| GET    | `/api/bookings/confirm`      | Token              | Load booking confirmation     |
| GET    | `/api/bookings/[id]`         | User (own booking) | Booking details               |
| GET    | `/api/bookings/[id]/history` | User (own booking) | Audit trail                   |

### Restaurants

| Method | Endpoint                              | Auth | Purpose                               |
| ------ | ------------------------------------- | ---- | ------------------------------------- |
| GET    | `/api/restaurants`                    | None | List restaurants (⚠️ deprecated → v1) |
| GET    | `/api/v1/restaurants`                 | None | List restaurants (v1)                 |
| GET    | `/api/restaurants/[slug]/schedule`    | None | Operating hours (⚠️ deprecated → v1)  |
| GET    | `/api/v1/restaurants/[slug]/schedule` | None | Operating hours (v1)                  |

### User Profile

| Method | Endpoint             | Auth | Purpose        |
| ------ | -------------------- | ---- | -------------- |
| GET    | `/api/profile`       | User | Get profile    |
| PUT    | `/api/profile`       | User | Update profile |
| POST   | `/api/profile/image` | User | Upload image   |

### Ops (Staff)

| Method | Endpoint                        | Auth  | Purpose         |
| ------ | ------------------------------- | ----- | --------------- |
| GET    | `/api/ops/bookings`             | Staff | List bookings   |
| POST   | `/api/ops/bookings`             | Staff | Create walk-in  |
| PUT    | `/api/ops/bookings/[id]/status` | Staff | Update status   |
| GET    | `/api/ops/bookings/export`      | Staff | Export CSV      |
| GET    | `/api/ops/customers`            | Staff | List customers  |
| GET    | `/api/ops/dashboard/summary`    | Staff | Dashboard stats |
| GET    | `/api/ops/dashboard/heatmap`    | Staff | Booking heatmap |

### Owner (Restaurant Admin)

| Method | Endpoint                                 | Auth   | Purpose                |
| ------ | ---------------------------------------- | ------ | ---------------------- |
| GET    | `/api/owner/team/invitations`            | Owner  | List team invitations  |
| POST   | `/api/owner/team/invitations`            | Owner  | Create team invitation |
| DELETE | `/api/owner/team/invitations/[inviteId]` | Owner  | Revoke invitation      |
| GET    | `/api/team/invitations/[token]`          | Public | Get invitation details |
| POST   | `/api/team/invitations/[token]/accept`   | Public | Accept invitation      |
| PUT    | `/api/owner/restaurants/[id]/details`    | Owner  | Update restaurant      |
| PUT    | `/api/owner/restaurants/[id]/hours`      | Owner  | Update hours           |

### Other

| Method | Endpoint             | Auth | Purpose            |
| ------ | -------------------- | ---- | ------------------ |
| GET    | `/api/auth/callback` | None | OAuth callback     |
| POST   | `/api/lead`          | None | Capture email lead |
| POST   | `/api/events`        | None | Analytics events   |

---

## Authentication Flow

```
User enters email → Supabase sends magic link → User clicks link
→ /api/auth/callback → Session created → Redirect to app
```

## Rate Limits

| Endpoint             | Limit | Window |
| -------------------- | ----- | ------ |
| Guest booking lookup | 20    | 60s    |
| Ops bookings list    | 120   | 60s    |
| Ops booking create   | 60    | 60s    |

## Database Tables

| Table                  | Purpose             |
| ---------------------- | ------------------- |
| `bookings`             | Reservation records |
| `customers`            | Customer profiles   |
| `restaurants`          | Restaurant details  |
| `team_memberships`     | Staff access        |
| `team_invitations`     | Pending invites     |
| `loyalty_programs`     | Loyalty configs     |
| `loyalty_transactions` | Points ledger       |
| `profiles`             | User profiles       |
| `audit_events`         | Audit trail         |

## External Services

| Service       | Purpose         |
| ------------- | --------------- |
| Supabase      | Database + Auth |
| Resend        | Email delivery  |
| Inngest       | Background jobs |
| Upstash Redis | Rate limiting   |

## Key Business Rules

1. **Operating Hours**: Bookings must fall within restaurant hours
2. **End Time Calculation**:
   - Breakfast: +1.5h
   - Lunch/Dinner: +2h
   - Drinks: +1h
3. **Unique Reference**: 6-char alphanumeric (e.g., "AB1234")
4. **Loyalty Points**: `points_per_guest * party_size`
5. **Idempotency**: Header `Idempotency-Key` prevents duplicates
6. **Walk-in Fallback**: Staff can create bookings without email/phone

## Common Error Codes

| Code                     | Status | Meaning                       |
| ------------------------ | ------ | ----------------------------- |
| UNAUTHENTICATED          | 401    | No session                    |
| FORBIDDEN                | 403    | Insufficient permissions      |
| INVALID_PAYLOAD          | 400    | Validation failed             |
| RATE_LIMITED             | 429    | Too many requests             |
| IDEMPOTENCY_KEY_CONFLICT | 409    | Duplicate with different data |

---

**For full details**: See [COMPREHENSIVE_ROUTE_ANALYSIS.md](./COMPREHENSIVE_ROUTE_ANALYSIS.md) (3,689 lines, 124KB)

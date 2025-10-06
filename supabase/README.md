# Database Setup & Management

This document describes the Supabase database setup for SajiloReserveX restaurant booking system.

## 📁 Structure

```
supabase/
├── migrations/
│   └── 20241006000001_initial_schema.sql    # Complete database schema
└── seed/
    └── 20241006000001_seed_data.sql         # Sample data (8 pubs with bookings)
```

## 🚀 Quick Start

### Prerequisites

- [Supabase CLI](https://supabase.com/docs/guides/cli) installed
- Docker Desktop running (for local development)

### Initial Setup

1. **Start Supabase locally:**

   ```bash
   npm run db:start
   # or
   supabase start
   ```

2. **Reset database (runs migrations + seeds):**

   ```bash
   npm run db:reset
   # or
   supabase db reset --force
   ```

3. **Open Supabase Studio:**
   ```bash
   npm run db:studio
   # or
   supabase studio
   ```

## 📊 What Gets Seeded

The seed file creates a realistic dataset:

### 8 Pubs

- The Queen Elizabeth Pub (120 capacity)
- Old Crown Pub (100 capacity)
- White Horse Pub (110 capacity)
- The Corner House Pub (90 capacity)
- Prince of Wales Pub (130 capacity)
- The Bell Sawtry (80 capacity)
- The Railway Pub (95 capacity)
- The Barley Mow Pub (105 capacity)

### Per Pub

- **12 tables** with varied capacities (2, 4, 6, 8 seats) and seating types (indoor, outdoor, bar, patio, private_room)
- **80 customers** with unique emails and phone numbers
- **50 bookings** distributed as:
  - 15 past bookings (CURRENT_DATE - 15 to -1 days)
  - 5 today bookings (CURRENT_DATE at different times)
  - 30 future bookings (CURRENT_DATE + 1 to +30 days)

### Booking Details

- **Time slots**: Rotates between 12:00, 13:30, 15:00, 17:30, 19:00, 20:30
- **Duration**: 105 minutes (1h 45m) each
- **Statuses**:
  - Past: mostly completed, some no_show/cancelled
  - Today: confirmed/pending
  - Future: confirmed/pending
- **No overlaps**: Each booking uses a unique table + time slot combination

## 🛠 Available Commands

```bash
# Start local Supabase
npm run db:start

# Stop local Supabase
npm run db:stop

# Check Supabase status
npm run db:status

# Reset database (drop all data, run migrations, run seeds)
npm run db:reset

# Open Supabase Studio UI
npm run db:studio
```

## 🗄 Schema Overview

### Core Tables

#### `restaurants`

- Main tenant table
- Includes timezone support for proper booking time handling
- Slug-based routing

#### `restaurant_memberships`

- Multi-tenant access control
- Roles: owner, admin, staff, viewer
- Links app users to restaurants

#### `customers`

- Per-restaurant customer database
- Unique email and phone per restaurant
- Optional link to auth users
- Marketing opt-in support

#### `restaurant_tables`

- Physical tables in each restaurant
- Configurable capacity and seating types
- Active/inactive status

#### `bookings`

- Core booking entity
- **Time handling**: Stores local date/time + computed UTC timestamps
- **Customer snapshot**: Captures customer info at booking time
- **Reference codes**: Human-friendly 10-char codes (no ambiguous chars)
- **Conflict prevention**: Enforced table overlap checking

### Key Features

#### 1. Timezone-Aware Bookings

- Restaurants have IANA timezone (e.g., 'Europe/London')
- Bookings store local date/time + computed UTC instants
- Triggers automatically compute `start_at`/`end_at` timestamps

#### 2. Row Level Security (RLS)

- All tables have RLS enabled
- Users only see data from restaurants they're members of
- Role-based permissions (owner > admin > staff > viewer)

#### 3. Overlap Prevention

- `EXCLUDE` constraint prevents double-booking tables
- Only applies to `confirmed` and `pending` bookings
- Cancelled/completed bookings don't block slots

#### 4. Data Integrity

- Cascading deletes for restaurant data
- Protected customer data (RESTRICT on bookings)
- Automatic `updated_at` timestamps
- Normalized email/phone for deduplication

## 🔄 Development Workflow

### Making Schema Changes

1. Create a new migration:

   ```bash
   supabase migration new your_migration_name
   ```

2. Edit the generated file in `supabase/migrations/`

3. Apply migrations:
   ```bash
   npm run db:reset
   ```

### Updating Seed Data

1. Edit `supabase/seed/20241006000001_seed_data.sql`

2. Reset database to apply:
   ```bash
   npm run db:reset
   ```

### Testing Locally

1. Start Supabase:

   ```bash
   npm run db:start
   ```

2. Your local database URL is shown in the output
   - Default: `postgresql://postgres:postgres@localhost:54322/postgres`

3. Update your `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<from supabase start output>
   SUPABASE_SERVICE_ROLE_KEY=<from supabase start output>
   ```

## 🚢 Deploying to Production

### Link to Remote Project

```bash
supabase link --project-ref <your-project-ref>
```

### Push Migrations

```bash
supabase db push
```

### Run Seeds (Optional - usually only for staging/testing)

```bash
# Be careful - this will add data to your production DB!
supabase db seed
```

## 📝 Customizing Seed Data

### Change Number of Items

Edit `supabase/seed/20241006000001_seed_data.sql`:

```sql
-- Change number of tables per pub (default: 12)
CROSS JOIN generate_series(1,12) AS gs

-- Change number of customers per pub (default: 80, keep ≥50)
CROSS JOIN generate_series(1,80) AS i

-- Change booking distribution
-- Past bookings: generate_series(1,15)
-- Today bookings: generate_series(0,4)
-- Future bookings: generate_series(1,30)
```

### Add More Pubs

Add entries to the `restaurants` VALUES in the seed file:

```sql
INSERT INTO public.restaurants (name, slug, timezone, capacity)
VALUES
  ('The Queen Elizabeth Pub', 'the-queen-elizabeth-pub', 'Europe/London', 120),
  ('Your New Pub', 'your-new-pub', 'Europe/London', 150),  -- Add here
  ...
```

### Change Booking Times

Modify the slots calculation:

```sql
-- Current: 12:00 + (idx % 6)*90 minutes
-- Custom example: 17:00 + (idx % 4)*60 minutes (hourly dinner slots)
(time '17:00' + make_interval(mins := ( (idx % 4) * 60 )))::time AS start_time
```

## 🔍 Useful Queries

### Check seed data counts

```sql
SELECT
  (SELECT COUNT(*) FROM restaurants) as pubs,
  (SELECT COUNT(*) FROM restaurant_tables) as tables,
  (SELECT COUNT(*) FROM customers) as customers,
  (SELECT COUNT(*) FROM bookings) as bookings;
```

### View bookings distribution

```sql
SELECT
  r.name,
  COUNT(CASE WHEN b.booking_date < CURRENT_DATE THEN 1 END) as past,
  COUNT(CASE WHEN b.booking_date = CURRENT_DATE THEN 1 END) as today,
  COUNT(CASE WHEN b.booking_date > CURRENT_DATE THEN 1 END) as future,
  COUNT(*) as total
FROM restaurants r
LEFT JOIN bookings b ON b.restaurant_id = r.id
GROUP BY r.id, r.name
ORDER BY r.name;
```

### Find overlapping bookings (should be 0)

```sql
SELECT
  b1.id as booking1,
  b2.id as booking2,
  b1.table_id,
  b1.start_at,
  b1.end_at
FROM bookings b1
JOIN bookings b2
  ON b1.table_id = b2.table_id
  AND b1.id < b2.id
  AND b1.status IN ('confirmed', 'pending')
  AND b2.status IN ('confirmed', 'pending')
  AND tstzrange(b1.start_at, b1.end_at, '[)') && tstzrange(b2.start_at, b2.end_at, '[)');
```

## 🐛 Troubleshooting

### "supabase: command not found"

Install the Supabase CLI:

```bash
brew install supabase/tap/supabase
```

### Docker not running

Start Docker Desktop before running `supabase start`

### Port conflicts

If ports are in use:

```bash
supabase stop
supabase start
```

### Reset everything

```bash
supabase stop
supabase db reset --force
supabase start
```

### Migrations out of sync

```bash
# Local
supabase db reset --force

# Remote
supabase db reset --linked
```

## 📚 Resources

- [Supabase CLI Documentation](https://supabase.com/docs/guides/cli)
- [Supabase Local Development](https://supabase.com/docs/guides/cli/local-development)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [Database Migrations](https://supabase.com/docs/guides/cli/managing-environments)

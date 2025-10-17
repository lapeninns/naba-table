# Seed Data Guide

**Comprehensive guide to the enhanced seed script for demo and development environments**

---

## Overview

The seed script (`supabase/utilities/init-seeds.sql`) provides a complete, realistic dataset covering all 23 database tables with diverse, production-like demo data.

**Purpose**: Create a rich demo environment that showcases all system features with realistic edge cases, status distributions, and customer diversity.

---

## Quick Start

```bash
# Seed the database (preserves existing data, truncates seed tables)
pnpm run db:seed-only

# Full reset: wipe + migrate + seed
pnpm run db:full-reset

# Verify seed data
pnpm run db:verify
```

---

## Table Coverage (23/23 Tables) ✅

### Core Business Tables

| Table               | Records | Description                                                               |
| ------------------- | ------- | ------------------------------------------------------------------------- |
| `restaurants`       | 8       | Multi-cuisine restaurants across London (Italian, French, Japanese, etc.) |
| `customers`         | 530     | Diverse customer base with realistic names, emails, phones                |
| `bookings`          | 310     | Past, today, and future bookings with varied statuses                     |
| `customer_profiles` | 530     | Enhanced with preferences, dietary needs, special occasions               |

### Capacity & Table Management

| Table                       | Records | Description                                        |
| --------------------------- | ------- | -------------------------------------------------- |
| `table_inventory`           | 128     | Tables (2-8 capacity) across all restaurants       |
| `restaurant_capacity_rules` | 64      | Base rules + Friday/event overrides per restaurant |
| `booking_slots`             | 208     | Time slots with version tracking for capacity      |
| `booking_table_assignments` | ~294    | Table assignments for confirmed bookings           |
| `capacity_metrics_hourly`   | 96      | Hourly utilization metrics for analytics           |

### Booking Lifecycle & History

| Table                   | Records | Description                                                |
| ----------------------- | ------- | ---------------------------------------------------------- |
| `booking_state_history` | ~744    | State transition audit trail (pending→confirmed→completed) |
| `booking_versions`      | 361     | Snapshot history for booking changes                       |
| `analytics_events`      | 584     | User actions and status changes for tracking               |

### Payments & Loyalty

| Table                  | Records | Description                                                    |
| ---------------------- | ------- | -------------------------------------------------------------- |
| `stripe_events`        | ~111    | Payment events (charge.succeeded, refunds) for 80% of bookings |
| `loyalty_programs`     | 8       | Tiered programs (Bronze→Silver→Gold→Platinum) per restaurant   |
| `loyalty_points`       | 40      | Customer point balances                                        |
| `loyalty_point_events` | 40      | Point earning/redemption history                               |

### Team & Administration

| Table                     | Records | Description                                |
| ------------------------- | ------- | ------------------------------------------ |
| `profiles`                | 1       | Admin profile (`admin@sajilo.example.com`) |
| `restaurant_memberships`  | 8       | Admin has owner access to all restaurants  |
| `restaurant_invites`      | 16      | Pending team invitations                   |
| `profile_update_requests` | 8       | Profile change requests (pending approval) |

### Configuration

| Table                        | Records | Description                             |
| ---------------------------- | ------- | --------------------------------------- |
| `restaurant_operating_hours` | Dynamic | Standard hours (Mon-Sun) per restaurant |
| `restaurant_service_periods` | Dynamic | Lunch/dinner/drinks service definitions |
| `audit_logs`                 | Dynamic | System-wide audit trail                 |

---

## Data Characteristics

### Booking Status Distribution

**Realistic status percentages based on typical restaurant operations:**

#### Past Bookings (~120 records)

- **84.5% Completed** - Successfully fulfilled reservations
- **10% Cancelled** - Customer cancellations (with history)
- **5.5% No-shows** - Customers who didn't arrive

#### Today's Bookings (~50 records)

- **62% Confirmed** - Ready to serve
- **14% Pending** - Awaiting customer confirmation
- **11% Pending Allocation** - Need table assignment
- **8% Checked In** - Currently dining
- **5% Cancelled** - Last-minute cancellations

#### Future Bookings (~140 records)

- **63.5% Confirmed** - Locked in reservations
- **20% Pending** - Awaiting confirmation
- **12.5% Pending Allocation** - Pre-confirmed, need tables
- **4% Cancelled** - Pre-cancelled (change of plans)

### Customer Profile Diversity

**Enhanced with JSONB preferences covering:**

#### Seating Preferences (8 types)

- Window, outdoor, booth, bar, quiet, corner, indoor, any

#### Dietary Restrictions (10+ types with combinations)

- Vegetarian (15%), Vegan (10%), Gluten-free (8%)
- Dairy-free (5%), Nut allergies (3%), Pescatarian (4%)
- Halal (3%), Kosher (2%)
- Multiple restrictions (e.g., vegan + nut-allergy)

#### Special Occasions (6 types)

- Birthday (8%), Anniversary (5%), Business meals (3%)
- Date nights (2%), Celebrations (2%), Proposals (1%)

#### Accessibility Needs

- Wheelchair access (5%), Highchair needed (3%)
- Combined needs (wheelchair + parking: 2%)

#### Ambiance Preferences

- Romantic, family-friendly, quiet, lively, formal, casual

#### Music Preferences

- Quiet background, live music, no preference

#### Customer Notes (~10% have notes)

- "Regular customer, prefers same table"
- "VIP - always ensure best service"
- "Celebrates anniversary here annually"
- "Food blogger - takes photos"
- "Corporate account - frequent business meals"

### Payment Events (Stripe)

**~111 events covering 80% of eligible bookings:**

- **Event Types**:
  - `charge.succeeded` - Completed bookings
  - `payment_intent.succeeded` - Confirmed bookings
  - `charge.refunded` - Cancelled bookings (~30% of cancellations)

- **Amounts**: £20-30 per person (randomized within range)
- **Status**: 90% processed, 10% pending webhook processing
- **Metadata**: Links to booking_id, restaurant_id, party details

---

## Customization Guide

### Adjust Restaurant Count

```sql
-- Line ~90: Change restaurant count (currently 8)
SELECT * FROM (
  VALUES
    (1, 'bella-napoli', 'Bella Napoli', ...),
    (2, 'le-petit-paris', 'Le Petit Paris', ...),
    -- Add more restaurants here
) AS r(...)
```

### Modify Booking Volume

```sql
-- Line ~250: Adjust bookings per restaurant per time bucket
CROSS JOIN LATERAL (
  SELECT generate_series(1, 15) AS booking_index  -- Change 15 to desired count
) AS booking_gen
```

### Change Status Distribution

```sql
-- Line ~440: Modify CASE statements for status
WHEN be.booking_index % 18 = 0 THEN 'no_show'::booking_status  -- Adjust divisor
WHEN be.booking_index % 10 = 0 THEN 'cancelled'::booking_status  -- Higher % = lower divisor
ELSE 'completed'::booking_status
```

### Adjust Customer Diversity

```sql
-- Line ~580: Modify preference probabilities
WHEN random() < 0.15 THEN jsonb_build_array('vegetarian')  -- 15% vegetarian
WHEN random() < 0.10 THEN jsonb_build_array('vegan')  -- 10% vegan
-- Adjust percentages as needed
```

### Customize Table Inventory

```sql
-- Line ~650: Modify table distribution
CASE
  WHEN gs BETWEEN 1 AND 4 THEN 2  -- 4 tables with capacity 2
  WHEN gs BETWEEN 5 AND 10 THEN 4  -- 6 tables with capacity 4
  -- Add/modify ranges
END AS capacity
```

---

## Expected Record Counts

After running `pnpm run db:seed-only`:

```
restaurants:        8
customers:          530
bookings:           310  (120 past, 50 today, 140 future)
tables:             128  (16 per restaurant)
capacity_rules:     64   (8 base + 24 overrides)
booking_slots:      208  (derived from bookings)
table_assignments:  ~294 (94% of confirmed bookings)
lifecycle_events:   ~744 (2-3 per booking avg)
booking_versions:   361  (1+ per booking)
analytics_events:   584  (2+ per booking)
loyalty_profiles:   40   (regular customers)
loyalty_events:     40   (points earned)
invites:            16   (2 per restaurant)
profile_updates:    8    (1 per restaurant)
capacity_metrics:   96   (hourly aggregates)
stripe_events:      ~111 (80% of eligible bookings)
```

---

## Verification

### Quick Check

```bash
pnpm run db:verify
```

### Manual Verification

```sql
-- Check table counts
SELECT
  (SELECT COUNT(*) FROM restaurants) AS restaurants,
  (SELECT COUNT(*) FROM customers) AS customers,
  (SELECT COUNT(*) FROM bookings) AS bookings,
  (SELECT COUNT(*) FROM stripe_events) AS stripe_events;

-- Check booking status distribution
SELECT status, COUNT(*), ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) AS percentage
FROM bookings
GROUP BY status
ORDER BY COUNT(*) DESC;

-- Check customer preferences variety
SELECT
  preferences->>'seatingPreference' AS seating,
  COUNT(*) AS count
FROM customer_profiles
WHERE preferences->>'seatingPreference' IS NOT NULL
GROUP BY seating
ORDER BY count DESC;

-- Check dietary restrictions
SELECT
  jsonb_array_length(preferences->'dietaryRestrictions') AS restriction_count,
  COUNT(*) AS customers
FROM customer_profiles
GROUP BY restriction_count
ORDER BY restriction_count;
```

---

## Troubleshooting

### Issue: Seed fails with "relation does not exist"

**Cause**: Migrations not applied
**Fix**:

```bash
supabase db push
pnpm run db:seed-only
```

### Issue: Lower than expected record counts

**Cause**: Random filters causing variance
**Solution**: This is expected - `random() < 0.8` means 80% probability, actual count varies by ~5-10%

### Issue: Customer profiles missing preferences

**Cause**: Random NULL assignments for variety
**Solution**: By design - not all customers have special preferences

### Issue: Stripe events count lower than bookings

**Cause**: Only 80% of eligible bookings get payment events
**Solution**: Expected behavior for realistic demo (some bookings don't require payment)

---

## Best Practices

### Development

- **Use `db:seed-only`** for iterative testing (faster, preserves migrations)
- **Use `db:full-reset`** when schema changes require fresh start
- **Check `db:verify`** after seeding to ensure data integrity

### Staging/Demo

- **Run seeds once** during environment setup
- **Don't re-seed** in environments with real user data
- **Backup first** if re-seeding on existing data

### Production

- **Never run seeds** in production environments
- Seeds are for **development and demo only**
- Use migrations for schema changes, manual data entry for real data

---

## Maintenance

### Adding New Tables

1. Create migration with table schema
2. Add INSERT section to `init-seeds.sql` following existing patterns
3. Update statistics query at end of script
4. Update this documentation with new table info
5. Test with `pnpm run db:full-reset`

### Modifying Seed Logic

1. Edit relevant section in `init-seeds.sql`
2. Test locally: `pnpm run db:seed-only`
3. Verify counts: `pnpm run db:verify`
4. Update documentation if expectations change
5. Commit with descriptive message

---

## Appendix: Seed Script Structure

```
init-seeds.sql (1830 lines)
├── Transaction & Setup (lines 1-60)
│   ├── BEGIN transaction
│   ├── Set timezone to UTC
│   └── Clear existing seed data
│
├── SECTION 1: Core Data (lines 60-640)
│   ├── Restaurants (8)
│   ├── Customers (530)
│   ├── Bookings (310)
│   └── Customer Profiles (530) ← ENHANCED with preferences
│
├── SECTION 2: Table Inventory (lines 640-720)
│   └── Tables (128 across restaurants)
│
├── SECTION 3: Today's Bookings (lines 720-850)
│   └── Additional 50 bookings for current day
│
├── SECTION 4: Capacity Rules (lines 850-1050)
│   ├── Base rules (32)
│   ├── Override rules (32)
│   └── Booking slots (208)
│
├── SECTION 5: Table Assignments (lines 1050-1150)
│   └── Assign tables to bookings (294)
│
├── SECTION 6: Lifecycle & History (lines 1150-1350)
│   ├── State history (744 transitions)
│   └── Booking versions (361 snapshots)
│
├── SECTION 7: Analytics Events (lines 1350-1450)
│   └── Event tracking (584 events)
│
├── SECTION 8: Loyalty System (lines 1450-1550)
│   ├── Programs (8)
│   ├── Points (40)
│   └── Events (40)
│
├── SECTION 9: Admin & Invites (lines 1550-1650)
│   ├── Admin profile
│   ├── Memberships (8)
│   ├── Invites (16)
│   └── Profile updates (8)
│
├── SECTION 10: Capacity Metrics (lines 1650-1700)
│   └── Hourly metrics (96)
│
├── SECTION 11: Stripe Events (lines 1700-1770) ← NEW
│   └── Payment events (111)
│
└── Finalization (lines 1770-1830)
    ├── COMMIT transaction
    └── Display statistics
```

---

**Last Updated**: 2025-10-17  
**Version**: 2.0 (Enhanced with customer diversity and Stripe events)  
**Maintainer**: SajiloReserveX Team

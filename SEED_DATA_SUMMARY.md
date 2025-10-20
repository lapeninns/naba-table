# Seed Data Summary - SajiloReserveX

## Overview

Comprehensive seed data for the La Pen Inns restaurant booking system with realistic test data.

## Database Contents

### 📊 Summary

- **8 Restaurants** - All La Pen Inns locations
- **400 Customers** - 50 customers per restaurant
- **200 Bookings** - 25 bookings per restaurant (past, present, and future)
- **1 Owner Account** - `owner@lapeninns.com`

### 🏢 Restaurants

1. **The Queen Elizabeth Pub** - King's Lynn
   - Email: thequeen@lapeninns.com
   - Phone: 01553 824083
   - Website: https://thequeenelizabethpub.co.uk

2. **Old Crown Pub (Girton)** - Cambridge
   - Email: oldcrown@lapeninns.com
   - Phone: 01223 277217
   - Website: https://oldcrowngirton.com

3. **White Horse Pub (Waterbeach)** - Cambridge
   - Email: whitehorse@lapeninns.com
   - Phone: 01223 375578
   - Website: https://whitehorsepub.co

4. **The Corner House Pub** - Cambridge
   - Email: cornerhouse@lapeninns.com
   - Phone: 01223 921122
   - Website: https://thecornerhousepub.co

5. **Prince of Wales Pub** - Bromham, Bedford
   - Email: theprince@lapeninns.com
   - Phone: 01234 822447
   - Mobile: +44 7438 699609
   - Website: https://princeofwalesbromham.com

6. **The Bell** - Sawtry, Huntingdon
   - Email: thebell@lapeninns.com
   - Phone: 01487 900149
   - Website: https://thebellsawtry.com

7. **The Railway Pub** - Whittlesey
   - Email: therailway@lapeninns.com
   - Phone: 01733 788345
   - Website: https://therailwaypub.co

8. **The Barley Mow Pub** - Hartford, Huntingdon
   - Email: barleymow@lapeninns.com
   - Phone: 01480 450550
   - Mobile: +44 7399 835329
   - Website: https://barleymowhartford.co.uk

### 🕐 Operating Hours (All Restaurants)

- **Monday - Friday**: 12:00 PM - 10:00 PM
- **Saturday - Sunday**: Closed

### 🍽️ Service Periods

Each restaurant has 3 service periods (weekdays only):

1. **Weekday Lunch**: 12:00 PM - 3:00 PM
2. **Happy Hour**: 3:00 PM - 5:00 PM
3. **Dinner Service**: 5:00 PM - 10:00 PM

### 👥 Customers

- **50 customers per restaurant** (400 total)
- Email format: `{restaurant-slug}.guest{number}@example.com`
- Names: `{Restaurant Name} Guest {number}`
- Unique phone numbers generated for each customer
- ~33% opted into marketing communications
- ~20% marked as VIP customers

### 📅 Bookings Distribution

Per restaurant (25 bookings each):

- **~8 Past bookings** - 1-8 days ago
- **~9 Today's bookings** - Current date
- **~8 Future bookings** - 1-8 days ahead

#### Booking Types:

- **Lunch bookings**: 12:00 PM (90 min duration)
- **Drinks bookings**: 3:30 PM (60 min duration)
- **Dinner bookings**: 6:00 PM (120 min duration)

#### Party Sizes:

- Range: 2-7 people
- Distributed evenly across bookings

#### Seating Preferences:

- ~75% Indoor
- ~25% Outdoor

#### Booking Status:

- ~95% Confirmed
- ~5% Cancelled (only in past bookings)

## 🔐 Access Credentials

**Owner Account:**

- Email: `owner@lapeninns.com`
- Password: (needs to be set in Supabase Auth)
- Role: Owner of all 8 restaurants

## 🚀 Running the Seed Script

### Local Development

```bash
# Execute seed script directly with psql
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f supabase/seeds/seed.sql
```

### Verification Queries

```sql
-- Check restaurants
SELECT COUNT(*) as restaurants FROM public.restaurants;

-- Check customers
SELECT COUNT(*) as customers FROM public.customers;

-- Check bookings
SELECT COUNT(*) as total_bookings FROM public.bookings;

-- Bookings by date
SELECT
  COUNT(*) FILTER (WHERE booking_date < current_date) as past,
  COUNT(*) FILTER (WHERE booking_date = current_date) as today,
  COUNT(*) FILTER (WHERE booking_date > current_date) as future
FROM public.bookings;

-- Bookings by type
SELECT booking_type, COUNT(*) as count
FROM public.bookings
GROUP BY booking_type;
```

## 📝 Notes

- All timestamps use `Europe/London` timezone
- Customer creation dates are randomized within the past 90 days
- Booking creation dates are randomized within the past 30 days
- Booking references follow the format: `LP-{6 random uppercase hex chars}`
- All data is regenerated each time the seed script runs (TRUNCATE CASCADE is used)

## 🔄 Resetting Data

To reset the database and reseed:

```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f supabase/seeds/seed.sql
```

This will:

1. Truncate all relevant tables
2. Recreate the owner account
3. Insert all restaurants, customers, and bookings
4. Set up operating hours and service periods

---

**Last Updated**: October 20, 2025
**Version**: 1.0

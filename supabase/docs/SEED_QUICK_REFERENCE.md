# Seed Data Quick Reference Card

**SajiloReserveX Seed Script v2.0** - Enhanced with customer diversity and Stripe payment events

---

## 🚀 Quick Commands

```bash
# Seed database (fast)
pnpm run db:seed-only

# Full reset (wipe + migrate + seed)
pnpm run db:full-reset

# Verify everything
pnpm run db:verify

# Check status
pnpm run db:status
```

---

## 📊 What Gets Seeded (23 Tables)

| Category     | Tables                                                                        | Records           |
| ------------ | ----------------------------------------------------------------------------- | ----------------- |
| **Core**     | restaurants, customers, bookings, customer_profiles                           | 8, 530, 310, 530  |
| **Tables**   | table_inventory                                                               | 128               |
| **Capacity** | capacity_rules, booking_slots, table_assignments, capacity_metrics_hourly     | 64, 208, ~294, 96 |
| **History**  | booking_state_history, booking_versions, analytics_events                     | ~744, 361, 584    |
| **Payments** | stripe_events ✨ NEW                                                          | ~111              |
| **Loyalty**  | loyalty_programs, loyalty_points, loyalty_point_events                        | 8, 40, 40         |
| **Admin**    | profiles, restaurant_memberships, restaurant_invites, profile_update_requests | 1, 8, 16, 8       |

**Total**: 23/23 tables ✅

---

## 🎯 Key Features

### Customer Preferences ✨ NEW

- **Seating**: 8 types (window, outdoor, booth, bar, quiet, corner, indoor, any)
- **Dietary**: 10+ types (vegetarian 15%, vegan 10%, gluten-free 8%, etc.)
- **Occasions**: birthday, anniversary, business, date, proposal, celebration
- **Accessibility**: wheelchair, highchair, parking
- **Ambiance**: romantic, family-friendly, quiet, lively, formal, casual
- **Notes**: VIP, food blogger, corporate account, regular customer

### Booking Status Distribution

| Period     | Top Statuses                                                    |
| ---------- | --------------------------------------------------------------- |
| **Past**   | 84.5% completed, 10% cancelled, 5.5% no-show                    |
| **Today**  | 62% confirmed, 14% pending, 11% pending_alloc, 8% checked_in    |
| **Future** | 63.5% confirmed, 20% pending, 12.5% pending_alloc, 4% cancelled |

### Stripe Events ✨ NEW

- **111 payment webhooks** (80% of eligible bookings)
- **Event types**: charge.succeeded, payment_intent.succeeded, charge.refunded
- **Amounts**: £20-30 per person
- **Status**: 90% processed, 10% pending

---

## 🔍 Quick Verification

```sql
-- Table counts
SELECT
  (SELECT COUNT(*) FROM restaurants) AS restaurants,
  (SELECT COUNT(*) FROM customers) AS customers,
  (SELECT COUNT(*) FROM bookings) AS bookings,
  (SELECT COUNT(*) FROM stripe_events) AS payments;

-- Status breakdown
SELECT status, COUNT(*)
FROM bookings
GROUP BY status
ORDER BY COUNT(*) DESC;

-- Customer preferences
SELECT
  preferences->>'seatingPreference' AS pref,
  COUNT(*) AS count
FROM customer_profiles
WHERE preferences->>'seatingPreference' IS NOT NULL
GROUP BY pref
ORDER BY count DESC;
```

---

## 📚 Documentation

- **Full Guide**: `supabase/docs/SEED_DATA_GUIDE.md`
- **Enhancement Summary**: `supabase/docs/SEED_ENHANCEMENT_SUMMARY.md`
- **Script Location**: `supabase/utilities/init-seeds.sql`

---

## ⚠️ Important Notes

- ✅ **Idempotent**: Safe to re-run (truncates before insert)
- ✅ **Atomic**: Single transaction (all or nothing)
- ✅ **Remote Only**: No local Supabase needed
- ⚠️ **Development Use**: Never run in production
- 📝 **Migrations First**: Run `supabase db push` before seeding

---

## 🎓 Use Cases

✅ Development: Test all features with realistic data  
✅ Demo: Showcase customer diversity and payment flows  
✅ Testing: Unit/integration/E2E with edge cases  
✅ Onboarding: New developers get working dataset instantly

---

**Version**: 2.0  
**Last Updated**: 2025-10-17  
**Status**: Production-ready for dev/demo environments

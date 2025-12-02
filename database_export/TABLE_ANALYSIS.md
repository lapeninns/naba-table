# Database Tables Analysis

## Summary

This document analyzes which tables are **REQUIRED** (actively used in code) vs **USELESS** (can be dropped).

---

## ✅ REQUIRED TABLES (Actively Used in Code)

These tables are essential for the restaurant booking system:

### Core Business Tables

| Table             | Purpose                            | Used In                         |
| ----------------- | ---------------------------------- | ------------------------------- |
| `restaurants`     | Restaurant configuration, settings | API routes, booking flow        |
| `bookings`        | Booking/reservation records        | Booking CRUD, status changes    |
| `customers`       | Customer records per restaurant    | Booking creation, profiles      |
| `profiles`        | User profiles (staff/owners)       | Authentication, user management |
| `table_inventory` | Physical tables in restaurant      | Table assignment, floor plan    |
| `zones`           | Restaurant zones/areas             | Table grouping, floor plan      |

### Booking Management

| Table                       | Purpose                             | Used In                              |
| --------------------------- | ----------------------------------- | ------------------------------------ |
| `booking_table_assignments` | Links bookings to tables            | Table assignment, floor plan         |
| `booking_occasions`         | Booking types (lunch, dinner, etc.) | Booking creation, occasion selection |
| `booking_slots`             | Available time slots                | Availability checking                |
| `booking_state_history`     | Booking status changes              | Audit, undo operations               |

### Restaurant Configuration

| Table                        | Purpose                        | Used In                        |
| ---------------------------- | ------------------------------ | ------------------------------ |
| `restaurant_memberships`     | Staff roles per restaurant     | Authorization, team management |
| `restaurant_operating_hours` | Open/close times               | Booking validation             |
| `restaurant_service_periods` | Service periods (lunch/dinner) | Slot generation                |
| `restaurant_invites`         | Team invitations               | Staff onboarding               |
| `allowed_capacities`         | Party size configurations      | Booking validation             |

### Table Management

| Table               | Purpose                             | Used In                     |
| ------------------- | ----------------------------------- | --------------------------- |
| `table_adjacencies` | Which tables are next to each other | Merge groups, large parties |
| `table_holds`       | Temporary table reservations        | Hold during booking         |
| `allocations`       | Table maintenance/blocks            | Table unavailability        |

### Supporting Tables

| Table                     | Purpose                               | Used In              |
| ------------------------- | ------------------------------------- | -------------------- |
| `customer_profiles`       | Customer stats (total bookings, etc.) | Customer insights    |
| `profile_update_requests` | Idempotency for profile updates       | Profile API          |
| `service_policy`          | Service configuration                 | Config API           |
| `merge_rules`             | Table merging rules                   | Large party handling |

---

## 🟡 OPTIONAL TABLES (Feature Flags/Future Use)

These exist for features that may not be active yet:

| Table                       | Purpose                     | Status          |
| --------------------------- | --------------------------- | --------------- |
| `feature_flag_overrides`    | Feature flag per restaurant | Ready but empty |
| `demand_profiles`           | Demand prediction           | Future feature  |
| `strategic_configs`         | Strategic capacity configs  | Future feature  |
| `restaurant_capacity_rules` | Advanced capacity rules     | Future feature  |

---

## 🔴 USELESS TABLES (Can Be Dropped)

These tables are either:

- Never used in code
- Leftover from experiments
- Obsolete

| Table                            | Reason                                 | Recommendation        |
| -------------------------------- | -------------------------------------- | --------------------- |
| `booking_occasions_audit`        | Only 2 rows, audit logging             | **DROP** - Not needed |
| `booking_assignment_idempotency` | Never used, always empty               | **DROP**              |
| `booking_confirmation_results`   | Never used, always empty               | **DROP**              |
| `booking_versions`               | Never used, always empty               | **DROP**              |
| `table_hold_members`             | Never used, always empty               | **DROP**              |
| `table_hold_windows`             | Never used, always empty               | **DROP**              |
| `table_scarcity_metrics`         | Never used, always empty               | **DROP**              |
| `user_profiles`                  | Never used, use `profiles` instead     | **DROP**              |
| `loyalty_point_events`           | Loyalty feature not implemented        | **DROP**              |
| `loyalty_points`                 | Loyalty feature not implemented        | **DROP**              |
| `loyalty_programs`               | Loyalty feature not implemented        | **DROP**              |
| `analytics_events`               | Never used, use `observability_events` | **DROP**              |
| `leads`                          | Marketing leads - not core feature     | **OPTIONAL**          |

### Tables Not Found (Already Dropped or Never Created)

These were in migrations but don't exist:

- `allocations_archive`
- `capacity_metrics_hourly`
- `manual_assignment_sessions`
- `merge_group_members`
- `merge_groups`
- `strategic_simulation_runs`
- `stripe_events`
- `waiting_list`

---

## 🧹 LOG/EVENT TABLES (Keep Schema, Clear Data)

| Table                  | Purpose                 | Recommendation                               |
| ---------------------- | ----------------------- | -------------------------------------------- |
| `audit_logs`           | Activity tracking       | **KEEP** schema, clear old data periodically |
| `observability_events` | System events/debugging | **KEEP** schema, clear old data periodically |
| `capacity_outbox`      | Async job queue         | **KEEP** schema, clear processed entries     |

---

## Recommended Actions

### 1. Tables to DROP (Safe to Remove)

```sql
-- Loyalty (not implemented)
DROP TABLE IF EXISTS loyalty_point_events;
DROP TABLE IF EXISTS loyalty_points;
DROP TABLE IF EXISTS loyalty_programs;

-- Unused booking tables
DROP TABLE IF EXISTS booking_assignment_idempotency;
DROP TABLE IF EXISTS booking_confirmation_results;
DROP TABLE IF EXISTS booking_versions;
DROP TABLE IF EXISTS booking_occasions_audit;

-- Unused table management
DROP TABLE IF EXISTS table_hold_members;
DROP TABLE IF EXISTS table_hold_windows;
DROP TABLE IF EXISTS table_scarcity_metrics;

-- Duplicates/unused
DROP TABLE IF EXISTS user_profiles;
DROP TABLE IF EXISTS analytics_events;
```

### 2. Tables to KEEP (Required for System)

**Core (13 tables):**

- restaurants
- bookings
- customers
- profiles
- table_inventory
- zones
- booking_table_assignments
- booking_occasions
- booking_slots
- booking_state_history
- restaurant_memberships
- restaurant_operating_hours
- restaurant_service_periods

**Supporting (6 tables):**

- restaurant_invites
- allowed_capacities
- table_adjacencies
- table_holds
- allocations
- customer_profiles

**Config (4 tables):**

- profile_update_requests
- service_policy
- merge_rules
- feature_flag_overrides

**Logs (3 tables):**

- audit_logs
- observability_events
- capacity_outbox

---

## Total Count

| Category              | Count  |
| --------------------- | ------ |
| Required Tables       | 26     |
| Useless (to drop)     | 12     |
| Already Gone          | 8      |
| **Net Tables Needed** | **26** |

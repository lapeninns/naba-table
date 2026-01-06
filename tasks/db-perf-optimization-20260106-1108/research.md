---
task: db-perf-optimization
timestamp_utc: 2026-01-06T11:08:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Database Performance & Scalability Optimization

## Requirements

### Functional Requirements

- Perform comprehensive database performance analysis
- Optimize slow queries without breaking existing functionality
- Improve index strategy
- Review and optimize RLS policies for performance
- Ensure data lifecycle management (vacuum, bloat control)

### Non-Functional Requirements

- **Security**: RLS must remain intact - no weakening of security policies
- **Performance**: Target ≥99% cache hit ratio, <100ms avg query time for common operations
- **Availability**: All changes must be reversible and safe for production
- **Consistency**: Maintain data integrity during optimization

---

## Existing Patterns & Reuse

### Database Configuration

- **PostgreSQL Version**: 17.6 (Supabase managed)
- **Key Extensions Enabled**:
  - `pg_stat_statements` (query statistics) ✅
  - `btree_gist` (GiST index support) ✅
  - `pgcrypto` (cryptographic functions)
  - `uuid-ossp` (UUID generation)
  - `citext` (case-insensitive text)
  - `pg_graphql` (GraphQL support)

### Schema Overview

#### Core Tables (by importance to booking flow)

| Table                       | Purpose                         | Foreign Keys                                  | RLS |
| --------------------------- | ------------------------------- | --------------------------------------------- | --- |
| `bookings`                  | Core reservation records        | customer_id, restaurant_id, table_id, zone_id | Yes |
| `customers`                 | Customer directory              | restaurant_id, user_profile_id                | Yes |
| `table_inventory`           | Physical tables                 | restaurant_id, zone_id                        | Yes |
| `allocations`               | Time-windowed table allocations | booking_id, restaurant_id                     | Yes |
| `booking_table_assignments` | Booking↔Table junction          | booking_id, table_id, allocation_id           | Yes |
| `table_holds`               | Temporary reservation holds     | booking_id, restaurant_id, zone_id            | Yes |
| `table_hold_members`        | Tables in a hold                | hold_id, table_id                             | Yes |
| `restaurants`               | Restaurant entities             | -                                             | Yes |
| `zones`                     | Restaurant floor zones          | restaurant_id                                 | Yes |

#### High-Write Tables (potential hot spots)

| Table                       | Write Pattern                         |
| --------------------------- | ------------------------------------- |
| `allocations`               | Created on every table assignment     |
| `booking_table_assignments` | Multiple per booking                  |
| `booking_state_history`     | Every status change                   |
| `booking_versions`          | Audit trail for changes               |
| `table_holds`               | Created for every reservation attempt |
| `observability_events`      | High-volume logging                   |
| `capacity_outbox`           | Event queue                           |

#### Supporting Tables

- `booking_occasions` - Event types (lunch, dinner, etc.)
- `allowed_capacities` - Valid party sizes
- `booking_slots` - Time slot definitions
- `restaurant_service_periods` - Operating hours
- `restaurant_operating_hours` - Opening/closing times
- `demand_profiles` - Demand multipliers

### Existing Index Strategy (67 indexes on public schema)

#### Well-Covered Tables ✅

- `bookings`: 4 indexes (restaurant+date, restaurant+status, status)
- `allocations`: 3 indexes (restaurant, window_gist, composite)
- `booking_table_assignments`: 5 indexes (booking_id, table_id, window_gist, merge_group)
- `table_holds`: 10+ indexes (various combinations)
- `customers`: 6 indexes (email, phone, auth_user, user_profile)

#### Index Types in Use

- **B-tree**: Majority of indexes (standard lookups)
- **GiST**: Used for `tstzrange` window columns in:
  - `allocations.window`
  - `booking_table_assignments.assignment_window`
  - `table_hold_windows.hold_window`
- **Hash**: None observed in public schema
- **GIN**: None observed (potential opportunity for JSONB)

### RLS Policies (observed from code patterns)

Based on the codebase, RLS policies typically:

1. Filter by `restaurant_id` for tenant isolation
2. May use `auth.uid()` for user-level access
3. Use `X-Restaurant-Id` header for service-role context

---

## External Resources

- [PostgreSQL 17 Performance Documentation](https://www.postgresql.org/docs/17/performance.html)
- [Supabase Performance Best Practices](https://supabase.com/docs/guides/database/performance)
- [EXPLAIN ANALYZE Guide](https://www.postgresql.org/docs/17/using-explain.html)

---

## Constraints & Risks

### Constraints

1. **Remote-Only**: Cannot run local Supabase - all changes target remote staging/production
2. **RLS Required**: Security policies cannot be weakened
3. **Multi-Tenant**: All optimizations must respect restaurant_id tenant isolation
4. **Zero Downtime**: Indexes must be created with `CONCURRENTLY`
5. **Supabase Plan Limits**: May have connection limits, compute constraints

### Risks

| Risk                                 | Impact   | Mitigation                           |
| ------------------------------------ | -------- | ------------------------------------ |
| Index creation blocks writes         | High     | Use `CREATE INDEX CONCURRENTLY`      |
| RLS policy changes break security    | Critical | Test in staging first                |
| Query optimization changes semantics | High     | Verify with unit tests               |
| Vacuum operations lock tables        | Medium   | Schedule during low traffic          |
| Large table alterations              | High     | Use expand→backfill→contract pattern |

---

## Baseline Data Collected (Staging)

### Data Volumes (as of 2026-01-06)

| Table             | Row Count | Notes              |
| ----------------- | --------- | ------------------ |
| `customers`       | 150       | Customer directory |
| `bookings`        | 90        | Reservations       |
| `allocations`     | 77        | Table assignments  |
| `table_inventory` | 64        | Physical tables    |
| `restaurants`     | 3         | Active venues      |

### Booking Status Breakdown

| Status     | Count | %     |
| ---------- | ----- | ----- |
| confirmed  | 52    | 57.8% |
| completed  | 24    | 26.7% |
| pending    | 10    | 11.1% |
| checked_in | 2     | 2.2%  |
| no_show    | 1     | 1.1%  |
| cancelled  | 1     | 1.1%  |

### Active Restaurants

1. **White Horse Pub** (`white-horse-pub-waterbeach`) - Active ✅
2. **The Corner House Pub** (`the-corner-house-pub-cambridge`) - Active ✅
3. **The Old Crown Girton** (`the-old-crown-girton`) - Active ✅

---

## Open Questions (owner, due)

1. **Q**: What is the cache hit ratio?
   - **Owner**: @developer
   - **Due**: Run SQL in Supabase Dashboard
   - **Status**: SQL provided in `artifacts/run-in-supabase-sql-editor.sql`

2. **Q**: What are the top slow queries from pg_stat_statements?
   - **Owner**: @developer
   - **Due**: Run SQL in Supabase Dashboard
3. **Q**: Are there unused indexes to remove?
   - **Owner**: @developer
   - **Due**: Run SQL in Supabase Dashboard

---

## Recommended Direction (with rationale)

### Phase 1: Discovery (BLOCKED - needs credentials)

1. Run `scripts/db-perf-baseline.ts` with valid database credentials
2. Capture baseline metrics to `artifacts/baseline-results.json`
3. Analyze pg_stat_statements for slow queries

### Phase 2: Quick Wins (Low Risk, High Impact)

1. **Add missing FK indexes** - Found gaps in foreign key coverage
2. **Composite indexes** for common query patterns
3. **Partial indexes** for status filters (e.g., `WHERE status = 'active'`)
4. **ANALYZE** on high-churn tables

### Phase 3: Query Optimization

1. Review and optimize top 10 slow queries
2. Consider materialized views for dashboard aggregations
3. Optimize RLS policy predicates

### Phase 4: Schema Improvements

1. Evaluate JSONB column indexing needs for `details`, `payload` columns
2. Consider archiving old data from history tables
3. Evaluate partitioning for `bookings` by date if table grows large

### Phase 5: Maintenance Strategy

1. Configure per-table autovacuum thresholds
2. Implement monitoring queries
3. Create maintenance runbook

---

## Baseline Script

Created: `scripts/db-perf-baseline.ts`

To run:

```bash
SUPABASE_DB_URL="postgresql://postgres:PASSWORD@db.xxx.supabase.co:5432/postgres" \
  npx tsx scripts/db-perf-baseline.ts
```

This will generate comprehensive baseline metrics in JSON format.

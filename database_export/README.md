# Database Export Summary

**Export Date:** December 2, 2025  
**Supabase URL:** https://mqtchcaavsucsdjskptc.supabase.co

---

## Export Overview

| Metric                 | Value |
| ---------------------- | ----- |
| Total Tables Processed | 40    |
| Tables with Data       | 18    |
| Empty Tables           | 22    |
| Tables Not Found       | 10    |
| Total Rows Exported    | 1,767 |

---

## File Structure

```
database_export/
├── README.md                          # This file
├── full_database_export.json          # Complete export of all tables with data
├── export_summary.json                # Summary statistics
├── DATABASE_SCHEMA.md                 # Human-readable schema documentation
├── database_schemas.json              # JSON schema definitions
├── database_functions.md              # Functions, views, triggers, policies, indexes
├── migration_files_list.txt           # List of all migration files
├── migrations_backup/                 # Complete copy of all migration SQL files
│
├── # Individual Table Exports (JSON)
├── table_allowed_capacities.json      # 3 rows
├── table_audit_logs.json              # 428 rows
├── table_booking_occasions.json       # 3 rows
├── table_booking_occasions_audit.json # 2 rows
├── table_booking_slots.json           # 42 rows
├── table_capacity_outbox.json         # 241 rows
├── table_customer_profiles.json       # 1 row
├── table_customers.json               # 1 row
├── table_observability_events.json    # 871 rows
├── table_profile_update_requests.json # 1 row
├── table_profiles.json                # 1 row
├── table_restaurant_memberships.json  # 7 rows
├── table_restaurant_operating_hours.json # 21 rows
├── table_restaurant_service_periods.json # 31 rows
├── table_restaurants.json             # 6 rows
├── table_table_adjacencies.json       # 76 rows
├── table_table_inventory.json         # 26 rows
└── table_zones.json                   # 6 rows
```

---

## Tables with Data (18 tables, 1,767 rows)

| Table Name                 | Row Count |
| -------------------------- | --------- |
| observability_events       | 871       |
| audit_logs                 | 428       |
| capacity_outbox            | 241       |
| table_adjacencies          | 76        |
| booking_slots              | 42        |
| restaurant_service_periods | 31        |
| table_inventory            | 26        |
| restaurant_operating_hours | 21        |
| restaurant_memberships     | 7         |
| restaurants                | 6         |
| zones                      | 6         |
| allowed_capacities         | 3         |
| booking_occasions          | 3         |
| booking_occasions_audit    | 2         |
| customer_profiles          | 1         |
| customers                  | 1         |
| profile_update_requests    | 1         |
| profiles                   | 1         |

---

## Empty Tables (22 tables)

- allocations
- analytics_events
- booking_assignment_idempotency
- booking_confirmation_results
- booking_state_history
- booking_table_assignments
- booking_versions
- bookings
- demand_profiles
- feature_flag_overrides
- loyalty_point_events
- loyalty_points
- loyalty_programs
- restaurant_capacity_rules
- restaurant_invites
- service_policy
- strategic_configs
- table_hold_members
- table_hold_windows
- table_holds
- table_scarcity_metrics
- user_profiles

---

## Tables Not Found in Current Schema (10 tables)

These tables were defined in migrations but may have been dropped or renamed:

- allocations_archive
- capacity_metrics_hourly
- leads
- manual_assignment_sessions
- merge_group_members
- merge_groups
- merge_rules
- strategic_simulation_runs
- stripe_events
- waiting_list

---

## How to Use This Export

### Restoring Data

To import the data into a new Supabase instance:

1. First apply the migrations from `migrations_backup/`
2. Then use the JSON files to seed data

### Viewing Schema

- **Human readable:** `DATABASE_SCHEMA.md`
- **Machine readable:** `database_schemas.json`

### Viewing All Data

- **Complete export:** `full_database_export.json` (contains all tables and rows)
- **Individual tables:** `table_*.json` files

### Database Objects

- **Functions, Views, Triggers, Policies, Indexes:** `database_functions.md`

---

## Scripts Included

- `export_database.js` - Main export script (exports all table data)
- `export_schema.js` - Schema extraction script
- `extract_db_objects.sh` - Extracts DB objects from migrations

To re-run the export:

```bash
export SUPABASE_SERVICE_ROLE_KEY="your-key"
node export_database.js
node export_schema.js
./extract_db_objects.sh
```

---

## Notes

- All data is from the remote Supabase instance (remote-only per AGENTS.md policy)
- Timestamps are preserved as ISO-8601 strings
- UUIDs and foreign key references are maintained
- JSONB columns are exported as nested JSON objects
